from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import pandas as pd
import numpy as np
from app import db

anomaly_bp = Blueprint('anomaly', __name__)


@anomaly_bp.route('/ml/anomalies', methods=['POST'])
@jwt_required()
def detect_anomalies():
    body = request.get_json()
    table = body.get('table')
    date_col = body.get('date_column')
    value_col = body.get('value_column')
    sensitivity = float(body.get('sensitivity', 0.95))

    if not all([table, date_col, value_col]):
        return jsonify({'error': 'table, date_column, value_column are required'}), 400

    try:
        from prophet import Prophet
    except ImportError:
        return jsonify({
            'error': 'Prophet is not installed. Run: pip install prophet',
            'fallback': 'Use /api/v1/ml/correlation for basic analysis.'
        }), 501

    df = pd.read_sql(f'SELECT "{date_col}", "{value_col}" FROM "{table}" ORDER BY "{date_col}"', db.engine)

    if len(df) < 10:
        return jsonify({'error': f'Need at least 10 rows, got {len(df)}'}), 422

    df_p = df[[date_col, value_col]].rename(columns={date_col: 'ds', value_col: 'y'})
    df_p['ds'] = pd.to_datetime(df_p['ds'], errors='coerce')
    df_p = df_p.dropna()
    df_p['y'] = pd.to_numeric(df_p['y'], errors='coerce').fillna(0)

    m = Prophet(
        interval_width=sensitivity,
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False
    )
    m.fit(df_p)
    forecast = m.predict(df_p)

    merged = df_p.copy()
    merged['yhat'] = forecast['yhat'].values
    merged['yhat_upper'] = forecast['yhat_upper'].values
    merged['yhat_lower'] = forecast['yhat_lower'].values
    merged['is_anomaly'] = (
        (merged['y'] > merged['yhat_upper']) |
        (merged['y'] < merged['yhat_lower'])
    )
    merged['deviation'] = ((merged['y'] - merged['yhat']) / merged['yhat'].abs().clip(lower=1) * 100).round(1)
    merged['severity'] = merged['deviation'].abs().apply(
        lambda x: 'high' if x > 50 else 'medium' if x > 20 else 'low'
    )

    anomalies = merged[merged['is_anomaly']].copy()
    anomaly_records = anomalies[[
        'ds', 'y', 'yhat', 'yhat_lower', 'yhat_upper', 'deviation', 'severity'
    ]].rename(columns={
        'ds': 'date', 'y': 'actual', 'yhat': 'expected',
        'yhat_lower': 'expected_lower', 'yhat_upper': 'expected_upper'
    }).astype({'date': str}).to_dict(orient='records')

    forecast_records = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].rename(
        columns={'ds': 'date'}
    ).astype({'date': str}).to_dict(orient='records')

    return jsonify({
        'total_rows': len(df),
        'anomaly_count': len(anomalies),
        'anomaly_rate': round(len(anomalies) / len(df) * 100, 1),
        'anomalies': anomaly_records,
        'forecast': forecast_records,
    })
