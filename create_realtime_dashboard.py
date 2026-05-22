from app import create_app, db
from app.models import Chart, Dashboard, DashboardPosition, Database
import random
from datetime import datetime, timedelta

app = create_app()
with app.app_context():
    db_conn = Database.query.filter_by(database_name='PostgreSQL Local').first()
    
    print('Creating real-time streaming charts...')
    
    realtime_charts = [
        {
            'name': 'Live User Activity Stream',
            'viz': 'line',
            'params': {
                'groupby': ['minute'],
                'metrics': [{'label': 'Active Users', 'expression': 'COUNT(DISTINCT user_id)'}],
                'row_limit': 60,
                'realtime': True,
                'refresh_interval': 5
            }
        },
        {
            'name': 'Real-Time AI Addiction Score',
            'viz': 'big_number',
            'params': {
                'metrics': [{'label': 'Avg Addiction Score', 'expression': 'AVG(ai_addiction_probability)'}],
                'realtime': True,
                'refresh_interval': 3
            }
        },
        {
            'name': 'Live Platform Usage Distribution',
            'viz': 'pie',
            'params': {
                'groupby': ['platform'],
                'metrics': [{'label': 'Current Users', 'expression': 'COUNT(*)'}],
                'realtime': True,
                'refresh_interval': 10
            }
        },
        {
            'name': 'Real-Time Mental Health Alerts',
            'viz': 'table',
            'params': {
                'groupby': ['user_id', 'anxiety_level', 'depression_score'],
                'metrics': [{'label': 'Risk Score', 'expression': 'MAX(risk_score)'}],
                'row_limit': 20,
                'realtime': True,
                'refresh_interval': 5
            }
        },
        {
            'name': 'Live Screen Time Monitor',
            'viz': 'area',
            'params': {
                'groupby': ['hour'],
                'metrics': [{'label': 'Avg Screen Time', 'expression': 'AVG(daily_screen_time_hours)'}],
                'row_limit': 24,
                'realtime': True,
                'refresh_interval': 15
            }
        },
        {
            'name': 'Real-Time Cyberbullying Detection',
            'viz': 'bar',
            'params': {
                'groupby': ['platform', 'severity'],
                'metrics': [{'label': 'Incidents', 'expression': 'COUNT(*)'}],
                'row_limit': 15,
                'realtime': True,
                'refresh_interval': 5
            }
        },
        {
            'name': 'Live Dopamine Trigger Heatmap',
            'viz': 'heatmap',
            'params': {
                'groupby': ['platform', 'hour'],
                'metrics': [{'label': 'Trigger Score', 'expression': 'AVG(dopamine_trigger_score)'}],
                'row_limit': 50,
                'realtime': True,
                'refresh_interval': 10
            }
        },
        {
            'name': 'Real-Time Sleep Quality Monitor',
            'viz': 'line',
            'params': {
                'groupby': ['date'],
                'metrics': [
                    {'label': 'Sleep Hours', 'expression': 'AVG(sleep_hours)'},
                    {'label': 'Sleep Quality', 'expression': 'AVG(sleep_quality_score)'}
                ],
                'row_limit': 30,
                'realtime': True,
                'refresh_interval': 30
            }
        }
    ]
    
    created_charts = []
    for chart_data in realtime_charts:
        chart = Chart(
            chart_name=chart_data['name'],
            viz_type=chart_data['viz'],
            params=chart_data['params'],
            query_context=chart_data['params'],
            description=f'Real-time chart from Kaggle dataset',
            datasource_id=db_conn.id,
            datasource_type='table',
            owner_id=1,
            cache_timeout=0
        )
        db.session.add(chart)
        db.session.flush()
        created_charts.append(chart)
        print(f'Created realtime chart: {chart.chart_name} (id={chart.id})')
    
    db.session.commit()
    
    dashboard = Dashboard(
        dashboard_title='Real-Time Mental Health Monitoring Dashboard',
        description='Live monitoring dashboard with real-time data streaming from Kaggle social media & mental health dataset',
        owner_id=1,
        position_json='{}',
        json_metadata={
            'native_filter_configuration': [],
            'realtime': True,
            'refresh_interval': 5
        }
    )
    db.session.add(dashboard)
    db.session.flush()
    print(f'Created dashboard: {dashboard.dashboard_title} (id={dashboard.id})')
    
    for i, chart in enumerate(created_charts):
        position = {
            'type': 'CHART',
            'id': f'CHART-RT-{i+1}',
            'children': [],
            'meta': {
                'chartId': chart.id,
                'width': 6,
                'height': 50,
                'tabName': 'Real-Time'
            }
        }
        dashboard_position = DashboardPosition(
            dashboard_id=dashboard.id,
            chart_id=chart.id,
            type='CHART',
            position_json=position
        )
        db.session.add(dashboard_position)
    
    db.session.commit()
    print(f'Added {len(created_charts)} real-time charts to dashboard')
    print('Real-time dashboard created successfully!')
