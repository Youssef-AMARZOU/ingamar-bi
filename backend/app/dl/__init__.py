from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.auth import get_current_user_id
from sqlalchemy import inspect
import pandas as pd
import numpy as np
import json
import pickle
import os
import uuid
import warnings
warnings.filterwarnings('ignore')

dl_bp = Blueprint('dl', __name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

def get_db_engine():
    from app import db as _db
    return _db.engine

def load_dataset(table_name):
    engine = get_db_engine()
    df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
    return df

@dl_bp.route('/datasets', methods=['GET'])
@jwt_required()
def list_datasets():
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
            datasets.append({
                'table_name': t,
                'row_count': row_count,
                'column_count': len(cols),
                'numeric_columns': numeric_cols,
                'columns': [{'name': c['name'], 'type': str(c['type'])} for c in cols],
            })
        except Exception:
            pass
    return jsonify(datasets)

@dl_bp.route('/train', methods=['POST'])
@jwt_required()
def train_neural_network():
    data = request.get_json()
    table_name = data.get('dataset')
    target = data.get('target')
    features = data.get('features', [])
    hidden_layers = data.get('hidden_layers', [64, 32])
    activation = data.get('activation', 'relu')
    epochs = data.get('epochs', 50)
    batch_size = data.get('batch_size', 32)
    learning_rate = data.get('learning_rate', 0.001)
    test_size = data.get('test_size', 0.2)
    random_state = data.get('random_state', 42)

    if not table_name or not target:
        return jsonify({'error': 'dataset and target are required'}), 400

    try:
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.neural_network import MLPRegressor, MLPClassifier
        from sklearn.metrics import (
            mean_squared_error, mean_absolute_error, r2_score,
            accuracy_score, precision_score, recall_score, f1_score,
            confusion_matrix
        )
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

    is_classification = len(np.unique(y)) <= 20

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Build MLP with specified architecture
    hidden_layer_sizes = tuple(hidden_layers) if isinstance(hidden_layers, list) else (64, 32)

    if is_classification:
        model = MLPClassifier(
            hidden_layer_sizes=hidden_layer_sizes,
            activation=activation,
            max_iter=epochs,
            batch_size=batch_size,
            learning_rate_init=learning_rate,
            random_state=random_state,
            early_stopping=True,
            verbose=False,
        )
    else:
        model = MLPRegressor(
            hidden_layer_sizes=hidden_layer_sizes,
            activation=activation,
            max_iter=epochs,
            batch_size=batch_size,
            learning_rate_init=learning_rate,
            random_state=random_state,
            early_stopping=True,
            verbose=False,
        )

    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)

    # Metrics
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

    # Training loss history
    loss_curve = model.loss_curve_ if hasattr(model, 'loss_curve_') else []

    # Sample predictions
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
    model_data = {
        'model': model,
        'scaler': scaler,
        'label_encoders': label_encoders,
        'features': features,
        'target': target,
        'is_classification': is_classification,
        'table_name': table_name,
        'target_labels': target_labels,
        'label_mappings': label_mappings,
    }
    model_path = os.path.join(MODELS_DIR, f'dl_{model_id}.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)

    return jsonify({
        'model_id': model_id,
        'task': 'classification' if is_classification else 'regression',
        'architecture': {
            'hidden_layers': list(model.hidden_layer_sizes),
            'activation': activation,
            'epochs_trained': len(loss_curve),
            'total_epochs': epochs,
        },
        'metrics': metrics,
        'loss_curve': [round(float(l), 6) for l in loss_curve],
        'sample_predictions': sample_predictions,
        'train_size': len(X_train),
        'test_size': len(X_test),
        'n_features': len(features),
    })

@dl_bp.route('/predict', methods=['POST'])
@jwt_required()
def predict_nn():
    data = request.get_json()
    model_id = data.get('model_id')
    input_data = data.get('input_data', {})

    if not model_id:
        return jsonify({'error': 'model_id is required'}), 400

    model_path = os.path.join(MODELS_DIR, f'dl_{model_id}.pkl')
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

@dl_bp.route('/models', methods=['GET'])
@jwt_required()
def list_models():
    models = []
    for fname in os.listdir(MODELS_DIR):
        if fname.startswith('dl_') and fname.endswith('.pkl'):
            model_id = fname.replace('dl_', '').replace('.pkl', '')
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
                    'name': saved.get('name', f"{saved.get('table_name', 'unknown')} → {saved.get('target', 'unknown')}"),
                    'target_labels': saved.get('target_labels', None),
                    'created': os.path.getmtime(model_path),
                })
            except Exception:
                pass
    return jsonify(models)

@dl_bp.route('/models/<model_id>', methods=['DELETE'])
@jwt_required()
def delete_model(model_id):
    model_path = os.path.join(MODELS_DIR, f'dl_{model_id}.pkl')
    if os.path.exists(model_path):
        os.remove(model_path)
        return jsonify({'message': 'Model deleted'})
    return jsonify({'error': 'Model not found'}), 404

@dl_bp.route('/models/<model_id>/name', methods=['PUT'])
@jwt_required()
def rename_model(model_id):
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    model_path = os.path.join(MODELS_DIR, f'dl_{model_id}.pkl')
    if not os.path.exists(model_path):
        return jsonify({'error': 'Model not found'}), 404

    with open(model_path, 'rb') as f:
        saved = pickle.load(f)
    saved['name'] = name
    with open(model_path, 'wb') as f:
        pickle.dump(saved, f)
    return jsonify({'message': 'Model renamed', 'name': name})
