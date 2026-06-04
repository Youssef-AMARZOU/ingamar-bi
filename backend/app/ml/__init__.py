from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.auth import get_current_user_id
from sqlalchemy import inspect, text
import pandas as pd
import numpy as np
import json
import re
import pickle
import os
import uuid

ml_bp = Blueprint('ml', __name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

def get_db_engine():
    from app import db as _db
    return _db.engine

def load_dataset(table_name):
    engine = get_db_engine()
    df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
    return df

@ml_bp.route('/datasets', methods=['GET'])
@jwt_required()
def list_ml_datasets():
    engine = get_db_engine()
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    datasets = []
    for t in tables:
        if t.startswith('_') or t == 'alembic_version':
            continue
        try:
            cols = inspector.get_columns(t)
            df = pd.read_sql(f'SELECT COUNT(*) as cnt FROM "{t}"', engine)
            row_count = int(df.iloc[0]['cnt'])
            numeric_cols = [c['name'] for c in cols if any(tp in str(c['type']).lower() for tp in ['int', 'float', 'double', 'decimal', 'real'])]
            categorical_cols = [c['name'] for c in cols if c['name'] not in numeric_cols]
            datasets.append({
                'table_name': t,
                'row_count': row_count,
                'column_count': len(cols),
                'numeric_columns': numeric_cols,
                'categorical_columns': categorical_cols,
                'columns': [{'name': c['name'], 'type': str(c['type'])} for c in cols],
            })
        except Exception:
            pass
    return jsonify(datasets)

@ml_bp.route('/train', methods=['POST'])
@jwt_required()
def train_model():
    data = request.get_json()
    table_name = data.get('dataset')
    target = data.get('target')
    features = data.get('features', [])
    model_type = data.get('model_type', 'auto')
    test_size = data.get('test_size', 0.2)
    random_state = data.get('random_state', 42)

    if not table_name or not target:
        return jsonify({'error': 'dataset and target are required'}), 400

    engine = get_db_engine()
    row_count = int(pd.read_sql(f'SELECT COUNT(*) as cnt FROM "{table_name}"', engine).iloc[0]['cnt'])
    if row_count < 10:
        return jsonify({
            'error': f"Not enough data to train. Table '{table_name}' has {row_count} rows. Need at least 10.",
            'suggestion': 'Upload a dataset first or use the user_retail_sample dataset.'
        }), 422

    try:
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.linear_model import LinearRegression, LogisticRegression, Lasso, Ridge, ElasticNet
        from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor, GradientBoostingClassifier
        from sklearn.svm import SVR, SVC
        from sklearn.neighbors import KNeighborsRegressor, KNeighborsClassifier
        from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
        from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
        from sklearn.metrics import (
            mean_squared_error, mean_absolute_error, r2_score,
            accuracy_score, precision_score, recall_score, f1_score,
            confusion_matrix, silhouette_score, calinski_harabasz_score
        )
        from sklearn.decomposition import PCA
        import warnings
        warnings.filterwarnings('ignore')
    except ImportError:
        return jsonify({'error': 'scikit-learn not installed'}), 500

    df = load_dataset(table_name)
    if target not in df.columns:
        return jsonify({'error': f'Target column "{target}" not found'}), 400

    if not features:
        features = [c for c in df.columns if c != target]

    X = df[features].copy()
    y = df[target].copy()

    label_encoders = {}
    label_mappings = {}
    for col in X.columns:
        if X[col].dtype == 'object':
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            label_encoders[col] = le
            label_mappings[col] = {int(k): str(v) for k, v in zip(le.transform(le.classes_), le.classes_)}

    target_labels = None
    if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))
        label_encoders['__target__'] = le
        target_labels = {int(k): str(v) for k, v in zip(le.transform(le.classes_), le.classes_)}

    X = X.fillna(0)
    y = pd.Series(y).fillna(0)

    is_classification = len(np.unique(y)) <= 20 or data.get('task') == 'classification'
    is_clustering = model_type in ['kmeans', 'dbscan', 'agglomerative']

    if is_clustering:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        if model_type == 'kmeans':
            n_clusters = data.get('n_clusters', 3)
            model = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
        elif model_type == 'dbscan':
            model = DBSCAN(eps=data.get('eps', 0.5), min_samples=data.get('min_samples', 5))
        else:
            n_clusters = data.get('n_clusters', 3)
            model = AgglomerativeClustering(n_clusters=n_clusters)

        labels = model.fit_predict(X_scaled)
        metrics = {}
        if len(set(labels)) > 1:
            metrics['silhouette_score'] = round(float(silhouette_score(X_scaled, labels)), 4)
            metrics['calinski_harabasz'] = round(float(calinski_harabasz_score(X_scaled, labels)), 4)
        metrics['n_clusters'] = len(set(labels))
        metrics['cluster_sizes'] = {int(k): int(v) for k, v in zip(*np.unique(labels, return_counts=True))}

        return jsonify({
            'task': 'clustering',
            'model_type': model_type,
            'metrics': metrics,
            'labels': labels.tolist()[:1000],
            'feature_importance': {},
        })

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    if model_type == 'auto':
        if is_classification:
            model_type = 'random_forest_classifier'
        else:
            model_type = 'random_forest_regressor'

    models = {
        'linear_regression': LinearRegression(),
        'lasso': Lasso(alpha=data.get('alpha', 1.0)),
        'ridge': Ridge(alpha=data.get('alpha', 1.0)),
        'elasticnet': ElasticNet(alpha=data.get('alpha', 1.0), l1_ratio=data.get('l1_ratio', 0.5)),
        'logistic_regression': LogisticRegression(max_iter=1000, random_state=random_state),
        'random_forest_regressor': RandomForestRegressor(n_estimators=100, random_state=random_state),
        'random_forest_classifier': RandomForestClassifier(n_estimators=100, random_state=random_state),
        'gradient_boosting_regressor': GradientBoostingRegressor(n_estimators=100, random_state=random_state),
        'gradient_boosting_classifier': GradientBoostingClassifier(n_estimators=100, random_state=random_state),
        'svr': SVR(),
        'svc': SVC(probability=True),
        'knn_regressor': KNeighborsRegressor(n_neighbors=data.get('n_neighbors', 5)),
        'knn_classifier': KNeighborsClassifier(n_neighbors=data.get('n_neighbors', 5)),
        'decision_tree_regressor': DecisionTreeRegressor(random_state=random_state),
        'decision_tree_classifier': DecisionTreeClassifier(random_state=random_state),
    }

    if model_type not in models:
        return jsonify({'error': f'Unknown model type: {model_type}'}), 400

    model = models[model_type]
    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)

    metrics = {}
    if is_classification:
        metrics['accuracy'] = round(float(accuracy_score(y_test, y_pred)), 4)
        metrics['precision'] = round(float(precision_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
        metrics['recall'] = round(float(recall_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
        metrics['f1_score'] = round(float(f1_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
        try:
            cm = confusion_matrix(y_test, y_pred)
            metrics['confusion_matrix'] = cm.tolist()
        except Exception:
            pass
    else:
        metrics['mse'] = round(float(mean_squared_error(y_test, y_pred)), 4)
        metrics['rmse'] = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4)
        metrics['mae'] = round(float(mean_absolute_error(y_test, y_pred)), 4)
        metrics['r2_score'] = round(float(r2_score(y_test, y_pred)), 4)

    feature_importance = {}
    if hasattr(model, 'feature_importances_'):
        for fname, imp in zip(features, model.feature_importances_):
            feature_importance[fname] = round(float(imp), 4)
    elif hasattr(model, 'coef_'):
        coefs = model.coef_
        if len(coefs.shape) > 1:
            coefs = coefs[0]
        for fname, coef in zip(features, coefs):
            feature_importance[fname] = round(float(coef), 4)

    feature_importance = dict(sorted(feature_importance.items(), key=lambda x: abs(x[1]), reverse=True))

    sample_predictions = []
    for i in range(min(20, len(y_test))):
        actual_val = float(y_test.iloc[i]) if hasattr(y_test, 'iloc') else float(y_test[i])
        pred_val = float(y_pred[i])
        
        actual_label = target_labels.get(int(round(actual_val)), str(actual_val)) if target_labels and is_classification else str(actual_val)
        pred_label = target_labels.get(int(round(pred_val)), str(pred_val)) if target_labels and is_classification else str(pred_val)
        
        sample_predictions.append({
            'actual': round(actual_val, 4),
            'predicted': round(pred_val, 4),
            'actual_label': actual_label,
            'predicted_label': pred_label,
        })

    model_id = str(uuid.uuid4())[:8]
    model_name = data.get('model_name', f"{table_name} → {target}")
    model_data = {
        'model': model,
        'scaler': scaler,
        'label_encoders': label_encoders,
        'features': features,
        'target': target,
        'is_classification': is_classification,
        'table_name': table_name,
        'model_type': model_type,
        'target_labels': target_labels,
        'label_mappings': label_mappings,
        'name': model_name,
    }
    model_path = os.path.join(MODELS_DIR, f'ml_{model_id}.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)

    return jsonify({
        'model_id': model_id,
        'task': 'classification' if is_classification else 'regression',
        'model_type': model_type,
        'metrics': metrics,
        'feature_importance': feature_importance,
        'sample_predictions': sample_predictions,
        'train_size': len(X_train),
        'test_size': len(X_test),
        'n_features': len(features),
        'target_labels': target_labels,
        'label_mappings': label_mappings,
    })

@ml_bp.route('/predict', methods=['POST'])
@jwt_required()
def predict():
    data = request.get_json()
    table_name = data.get('dataset')
    target = data.get('target')
    features = data.get('features', [])
    model_type = data.get('model_type', 'auto')
    input_data = data.get('input_data', {})

    if not table_name or not target:
        return jsonify({'error': 'dataset and target are required'}), 400

    try:
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.linear_model import LinearRegression, LogisticRegression, Lasso, Ridge
        from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor, GradientBoostingClassifier
        import warnings
        warnings.filterwarnings('ignore')
    except ImportError:
        return jsonify({'error': 'scikit-learn not installed'}), 500

    df = load_dataset(table_name)
    if not features:
        features = [c for c in df.columns if c != target]

    X = df[features].copy()
    y = df[target].copy()

    label_encoders = {}
    target_labels = None
    for col in X.columns:
        if X[col].dtype == 'object':
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            label_encoders[col] = le

    if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))
        target_labels = {int(k): str(v) for k, v in zip(le.transform(le.classes_), le.classes_)}

    X = X.fillna(0)
    y = pd.Series(y).fillna(0)

    is_classification = len(np.unique(y)) <= 20

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    if model_type == 'auto':
        model_type = 'random_forest_classifier' if is_classification else 'random_forest_regressor'

    models = {
        'linear_regression': LinearRegression(),
        'lasso': Lasso(alpha=1.0),
        'ridge': Ridge(alpha=1.0),
        'logistic_regression': LogisticRegression(max_iter=1000),
        'random_forest_regressor': RandomForestRegressor(n_estimators=100),
        'random_forest_classifier': RandomForestClassifier(n_estimators=100),
        'gradient_boosting_regressor': GradientBoostingRegressor(n_estimators=100),
        'gradient_boosting_classifier': GradientBoostingClassifier(n_estimators=100),
    }

    model = models.get(model_type, RandomForestRegressor(n_estimators=100))
    model.fit(X_scaled, y)

    input_df = pd.DataFrame([input_data])
    for col in features:
        if col not in input_df.columns:
            input_df[col] = 0
        if col in label_encoders:
            try:
                input_df[col] = label_encoders[col].transform(input_df[col].astype(str))
            except ValueError:
                input_df[col] = 0
    input_df = input_df[features].fillna(0)
    input_scaled = scaler.transform(input_df)
    prediction = model.predict(input_scaled)

    pred_value = float(prediction[0])
    pred_label = target_labels.get(int(round(pred_value)), str(round(pred_value, 4))) if target_labels and is_classification else str(round(pred_value, 4))

    result = {
        'prediction': round(pred_value, 4),
        'prediction_label': pred_label,
        'is_classification': is_classification,
    }
    
    if hasattr(model, 'predict_proba') and is_classification and target_labels:
        proba = model.predict_proba(input_scaled)[0]
        result['probabilities'] = [
            {'class': target_labels.get(i, str(i)), 'probability': round(float(p), 4)}
            for i, p in enumerate(proba)
        ]

    return jsonify(result)

@ml_bp.route('/evaluate', methods=['POST'])
@jwt_required()
def evaluate_model():
    data = request.get_json()
    table_name = data.get('dataset')
    target = data.get('target')
    features = data.get('features', [])
    model_types = data.get('model_types', ['random_forest', 'gradient_boosting', 'linear', 'knn'])

    if not table_name or not target:
        return jsonify({'error': 'dataset and target are required'}), 400

    try:
        from sklearn.model_selection import cross_val_score
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.linear_model import LinearRegression, LogisticRegression, Lasso, Ridge
        from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor, GradientBoostingClassifier
        from sklearn.neighbors import KNeighborsRegressor, KNeighborsClassifier
        import warnings
        warnings.filterwarnings('ignore')
    except ImportError:
        return jsonify({'error': 'scikit-learn not installed'}), 500

    df = load_dataset(table_name)
    if not features:
        features = [c for c in df.columns if c != target]

    X = df[features].copy()
    y = df[target].copy()

    for col in X.columns:
        if X[col].dtype == 'object':
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))

    if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))

    X = X.fillna(0)
    y = pd.Series(y).fillna(0)

    is_classification = len(np.unique(y)) <= 20
    scoring = 'accuracy' if is_classification else 'r2'

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    results = []
    model_map = {
        'linear': (LogisticRegression(max_iter=1000) if is_classification else LinearRegression()),
        'lasso': Lasso(alpha=1.0),
        'ridge': Ridge(alpha=1.0),
        'random_forest': (RandomForestClassifier(n_estimators=100) if is_classification else RandomForestRegressor(n_estimators=100)),
        'gradient_boosting': (GradientBoostingClassifier(n_estimators=100) if is_classification else GradientBoostingRegressor(n_estimators=100)),
        'knn': (KNeighborsClassifier(n_neighbors=5) if is_classification else KNeighborsRegressor(n_neighbors=5)),
    }

    for name in model_types:
        if name not in model_map:
            continue
        model = model_map[name]
        try:
            scores = cross_val_score(model, X_scaled, y, cv=min(5, len(X)), scoring=scoring)
            results.append({
                'model': name,
                'mean_score': round(float(scores.mean()), 4),
                'std_score': round(float(scores.std()), 4),
                'scores': [round(float(s), 4) for s in scores],
            })
        except Exception as e:
            results.append({'model': name, 'error': str(e)})

    results.sort(key=lambda x: x.get('mean_score', 0), reverse=True)

    return jsonify({
        'task': 'classification' if is_classification else 'regression',
        'scoring_metric': scoring,
        'results': results,
        'best_model': results[0]['model'] if results else None,
    })

@ml_bp.route('/correlation', methods=['POST'])
@jwt_required()
def correlation_analysis():
    data = request.get_json()
    table_name = data.get('dataset')
    columns = data.get('columns', [])

    if not table_name:
        return jsonify({'error': 'dataset is required'}), 400

    df = load_dataset(table_name)
    if columns:
        df = df[columns]

    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return jsonify({'error': 'No numeric columns found'}), 400

    if numeric_df.shape[1] < 2:
        all_numeric = list(df.select_dtypes(include=[np.number]).columns)
        return jsonify({
            'error': 'Not enough numeric columns with variance to compute correlation.',
            'columns_found': all_numeric
        }), 422

    corr_matrix = numeric_df.corr().fillna(0)
    columns_list = corr_matrix.columns.tolist()
    corr_data = []
    for i, col1 in enumerate(columns_list):
        for j, col2 in enumerate(columns_list):
            corr_data.append({
                'x': col1,
                'y': col2,
                'value': round(float(corr_matrix.iloc[i, j]), 4),
            })

    stats = {}
    for col in columns_list:
        stats[col] = {
            'mean': round(float(numeric_df[col].mean()), 4),
            'std': round(float(numeric_df[col].std()), 4),
            'min': round(float(numeric_df[col].min()), 4),
            'max': round(float(numeric_df[col].max()), 4),
            'median': round(float(numeric_df[col].median()), 4),
            'skew': round(float(numeric_df[col].skew()), 4),
            'kurtosis': round(float(numeric_df[col].kurtosis()), 4),
        }

    return jsonify({
        'columns': columns_list,
        'correlation_matrix': corr_data,
        'statistics': stats,
        'row_count': len(df),
    })

@ml_bp.route('/feature-importance', methods=['POST'])
@jwt_required()
def feature_importance():
    data = request.get_json()
    table_name = data.get('dataset')
    target = data.get('target')
    features = data.get('features', [])

    if not table_name or not target:
        return jsonify({'error': 'dataset and target are required'}), 400

    try:
        from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
        from sklearn.preprocessing import LabelEncoder
        import warnings
        warnings.filterwarnings('ignore')
    except ImportError:
        return jsonify({'error': 'scikit-learn not installed'}), 500

    df = load_dataset(table_name)
    if not features:
        features = [c for c in df.columns if c != target]

    X = df[features].copy()
    y = df[target].copy()

    for col in X.columns:
        if X[col].dtype == 'object':
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))

    if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))

    X = X.fillna(0)
    y = pd.Series(y).fillna(0)

    is_classification = len(np.unique(y)) <= 20

    if is_classification:
        model = RandomForestClassifier(n_estimators=100, random_state=42)
    else:
        model = RandomForestRegressor(n_estimators=100, random_state=42)

    model.fit(X, y)
    importances = model.feature_importances_

    feature_imp = []
    for fname, imp in zip(features, importances):
        feature_imp.append({'feature': fname, 'importance': round(float(imp), 4)})

    feature_imp.sort(key=lambda x: x['importance'], reverse=True)

    return jsonify({
        'task': 'classification' if is_classification else 'regression',
        'feature_importance': feature_imp,
    })


@ml_bp.route('/models', methods=['GET'])
@jwt_required()
def list_ml_models():
    models = []
    for fname in os.listdir(MODELS_DIR):
        if fname.startswith('ml_') and fname.endswith('.pkl'):
            model_id = fname.replace('ml_', '').replace('.pkl', '')
            model_path = os.path.join(MODELS_DIR, fname)
            try:
                with open(model_path, 'rb') as f:
                    saved = pickle.load(f)
                models.append({
                    'model_id': model_id,
                    'table_name': saved.get('table_name', 'unknown'),
                    'target': saved.get('target', 'unknown'),
                    'features': saved.get('features', []),
                    'is_classification': saved.get('is_classification', False),
                    'model_type': saved.get('model_type', 'unknown'),
                    'name': saved.get('name', f"{saved.get('table_name', 'unknown')} → {saved.get('target', 'unknown')}"),
                    'target_labels': saved.get('target_labels', None),
                    'created': os.path.getmtime(model_path),
                })
            except Exception:
                pass
    models.sort(key=lambda x: x.get('created', 0), reverse=True)
    return jsonify(models)

@ml_bp.route('/models/<model_id>', methods=['DELETE'])
@jwt_required()
def delete_ml_model(model_id):
    model_path = os.path.join(MODELS_DIR, f'ml_{model_id}.pkl')
    if os.path.exists(model_path):
        os.remove(model_path)
        return jsonify({'message': 'Model deleted'})
    return jsonify({'error': 'Model not found'}), 404

@ml_bp.route('/models/<model_id>/name', methods=['PUT'])
@jwt_required()
def rename_ml_model(model_id):
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    model_path = os.path.join(MODELS_DIR, f'ml_{model_id}.pkl')
    if not os.path.exists(model_path):
        return jsonify({'error': 'Model not found'}), 404
    with open(model_path, 'rb') as f:
        saved = pickle.load(f)
    saved['name'] = name
    with open(model_path, 'wb') as f:
        pickle.dump(saved, f)
    return jsonify({'message': 'Model renamed', 'name': name})

@ml_bp.route('/models/predict', methods=['POST'])
@jwt_required()
def predict_from_saved_model():
    data = request.get_json()
    model_id = data.get('model_id')
    input_data = data.get('input_data', {})

    if not model_id:
        return jsonify({'error': 'model_id is required'}), 400

    model_path = os.path.join(MODELS_DIR, f'ml_{model_id}.pkl')
    if not os.path.exists(model_path):
        return jsonify({'error': 'Model not found. Train a model first.'}), 404

    with open(model_path, 'rb') as f:
        saved = pickle.load(f)

    model = saved['model']
    scaler = saved['scaler']
    label_encoders = saved['label_encoders']
    features = saved['features']
    is_classification = saved['is_classification']
    target_labels = saved.get('target_labels', None)

    input_df = pd.DataFrame([input_data])
    for col in features:
        if col not in input_df.columns:
            input_df[col] = 0
        if col in label_encoders:
            try:
                input_df[col] = label_encoders[col].transform(input_df[col].astype(str))
            except Exception:
                input_df[col] = -1
    input_df = input_df[features].fillna(0)
    input_scaled = scaler.transform(input_df)
    prediction = model.predict(input_scaled)

    pred_value = float(prediction[0])
    pred_label = target_labels.get(int(round(pred_value)), str(round(pred_value, 4))) if target_labels and is_classification else str(round(pred_value, 4))

    result = {
        'prediction': round(pred_value, 4),
        'prediction_label': pred_label,
        'is_classification': is_classification,
    }
    if hasattr(model, 'predict_proba') and is_classification and target_labels:
        proba = model.predict_proba(input_scaled)[0]
        result['probabilities'] = [
            {'class': target_labels.get(i, str(i)), 'probability': round(float(p), 4)}
            for i, p in enumerate(proba)
        ]

    return jsonify(result)

@ml_bp.route('/explain', methods=['POST'])
@jwt_required()
def explain_prediction():
    data = request.get_json()
    model_id = data.get('model_id')
    input_data = data.get('input_data', {})
    num_features = data.get('num_features', 10)

    if not model_id:
        return jsonify({'error': 'model_id is required'}), 400

    model_path = os.path.join(MODELS_DIR, f'ml_{model_id}.pkl')
    if not os.path.exists(model_path):
        return jsonify({'error': 'Model not found'}), 404

    with open(model_path, 'rb') as f:
        saved = pickle.load(f)

    model = saved['model']
    scaler = saved['scaler']
    label_encoders = saved['label_encoders']
    features = saved['features']
    is_classification = saved['is_classification']
    target_labels = saved.get('target_labels', None)
    table_name = saved['table_name']

    try:
        engine = get_db_engine()
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
    except Exception:
        return jsonify({'error': 'Could not load dataset for explanation'}), 500

    X = df[features].copy()
    for col in X.columns:
        if X[col].dtype == 'object' and col in label_encoders:
            X[col] = label_encoders[col].transform(X[col].astype(str))
    X = X.fillna(0)
    X_scaled = scaler.transform(X)

    input_df = pd.DataFrame([input_data])
    for col in features:
        if col not in input_df.columns:
            input_df[col] = 0
        if col in label_encoders:
            try:
                input_df[col] = label_encoders[col].transform(input_df[col].astype(str))
            except Exception:
                input_df[col] = -1
    input_df = input_df[features].fillna(0)
    input_scaled = scaler.transform(input_df)

    base_prediction = model.predict(input_scaled)[0]
    feature_contributions = []

    for i, feat in enumerate(features):
        perturbed = input_scaled.copy()
        col_mean = X_scaled[:, i].mean()
        perturbed[0, i] = col_mean
        perturbed_pred = model.predict(perturbed)[0]
        contribution = float(base_prediction - perturbed_pred)
        feature_contributions.append({
            'feature': feat,
            'contribution': round(contribution, 4),
            'abs_contribution': round(abs(contribution), 4),
            'value': round(float(input_scaled[0, i]), 4),
            'mean': round(float(col_mean), 4),
        })

    feature_contributions.sort(key=lambda x: x['abs_contribution'], reverse=True)
    top_features = feature_contributions[:num_features]

    pred_value = float(base_prediction)
    pred_label = target_labels.get(int(round(pred_value)), str(round(pred_value, 4))) if target_labels and is_classification else str(round(pred_value, 4))

    return jsonify({
        'prediction': round(pred_value, 4),
        'prediction_label': pred_label,
        'is_classification': is_classification,
        'explanation': top_features,
        'method': 'perturbation-based (LIME-inspired)',
    })

@ml_bp.route('/simulate', methods=['POST'])
@jwt_required()
def monte_carlo_simulation():
    data = request.get_json()
    table_name = data.get('dataset')
    column = data.get('column')
    n_simulations = data.get('n_simulations', 1000)
    n_days = data.get('n_days', 30)
    confidence_level = data.get('confidence_level', 0.95)

    if not table_name or not column:
        return jsonify({'error': 'dataset and column are required'}), 400

    try:
        df = load_dataset(table_name)
        if column not in df.columns:
            return jsonify({'error': f'Column "{column}" not found'}), 400

        values = df[column].dropna().values.astype(float)
        if len(values) < 10:
            return jsonify({'error': 'Need at least 10 data points for simulation'}), 422

        log_returns = np.diff(np.log(values[values > 0]))
        mu = np.mean(log_returns)
        sigma = np.std(log_returns)
        last_value = values[-1]

        simulations = np.zeros((n_simulations, n_days))
        for i in range(n_simulations):
            daily_returns = np.random.normal(mu, sigma, n_days)
            simulations[i] = last_value * np.exp(np.cumsum(daily_returns))

        percentiles = [5, 25, 50, 75, 95]
        percentile_paths = {}
        for p in percentiles:
            percentile_paths[f'p{p}'] = [round(float(np.percentile(simulations[:, d], p)), 2) for d in range(n_days)]

        final_values = simulations[:, -1]
        alpha = (1 - confidence_level) / 2
        ci_low = float(np.percentile(final_values, alpha * 100))
        ci_high = float(np.percentile(final_values, (1 - alpha) * 100))

        return jsonify({
            'column': column,
            'last_value': round(float(last_value), 2),
            'n_simulations': n_simulations,
            'n_days': n_days,
            'mu': round(float(mu), 6),
            'sigma': round(float(sigma), 6),
            'percentile_paths': percentile_paths,
            'confidence_interval': {
                'level': confidence_level,
                'low': round(ci_low, 2),
                'high': round(ci_high, 2),
            },
            'final_stats': {
                'mean': round(float(np.mean(final_values)), 2),
                'median': round(float(np.median(final_values)), 2),
                'std': round(float(np.std(final_values)), 2),
                'min': round(float(np.min(final_values)), 2),
                'max': round(float(np.max(final_values)), 2),
            },
            'sample_paths': simulations[:10].tolist(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
