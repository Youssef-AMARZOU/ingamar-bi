from app import create_app, db
from app.models import Chart, Dashboard, DashboardPosition, Database

app = create_app()
with app.app_context():
    db_conn = Database.query.filter_by(database_name='PostgreSQL Local').first()
    if not db_conn:
        print('Database not found!')
        exit(1)
    
    print(f'Using database: {db_conn.database_name} (id={db_conn.id})')
    
    charts_data = [
        {
            'name': 'AI Addiction by Platform',
            'viz': 'bar',
            'table': 'kaggle_ai_recommendation_impact',
            'params': {
                'groupby': ['platform'],
                'metrics': [{'label': 'Avg AI Addiction', 'expression': 'AVG(ai_addiction_probability)'}],
                'row_limit': 20
            }
        },
        {
            'name': 'Echo Chamber Score Distribution',
            'viz': 'pie',
            'table': 'kaggle_ai_recommendation_impact',
            'params': {
                'groupby': ['echo_chamber_score'],
                'metrics': [{'label': 'Count', 'expression': 'COUNT(*)'}],
                'row_limit': 10
            }
        },
        {
            'name': 'Mental Health Trends',
            'viz': 'line',
            'table': 'kaggle_mental_health_trends',
            'params': {
                'groupby': ['year'],
                'metrics': [
                    {'label': 'Avg Anxiety', 'expression': 'AVG(anxiety_level)'},
                    {'label': 'Avg Depression', 'expression': 'AVG(depression_score)'}
                ],
                'row_limit': 50
            }
        },
        {
            'name': 'Screen Time by Age',
            'viz': 'bar',
            'table': 'kaggle_screen_time_behavior',
            'params': {
                'groupby': ['age_group'],
                'metrics': [{'label': 'Avg Daily Hours', 'expression': 'AVG(daily_screen_time_hours)'}],
                'row_limit': 20
            }
        },
        {
            'name': 'Sleep Disruption by Platform',
            'viz': 'bar',
            'table': 'kaggle_sleep_disruption',
            'params': {
                'groupby': ['platform'],
                'metrics': [
                    {'label': 'Avg Sleep Hours', 'expression': 'AVG(sleep_hours)'},
                    {'label': 'Avg Sleep Quality', 'expression': 'AVG(sleep_quality_score)'}
                ],
                'row_limit': 20
            }
        },
        {
            'name': 'Cyberbullying Impact',
            'viz': 'heatmap',
            'table': 'kaggle_cyberbullying_impact',
            'params': {
                'groupby': ['age_group', 'platform'],
                'metrics': [{'label': 'Avg Impact', 'expression': 'AVG(cyberbullying_impact_score)'}],
                'row_limit': 50
            }
        },
        {
            'name': 'Digital Detox Behavior',
            'viz': 'bar',
            'table': 'kaggle_digital_detox_behavior',
            'params': {
                'groupby': ['detox_frequency'],
                'metrics': [{'label': 'Count', 'expression': 'COUNT(*)'}],
                'row_limit': 20
            }
        },
        {
            'name': 'Dopamine Trigger Metrics',
            'viz': 'line',
            'table': 'kaggle_dopamine_trigger_metrics',
            'params': {
                'groupby': ['notification_frequency'],
                'metrics': [{'label': 'Avg Dopamine Score', 'expression': 'AVG(dopamine_trigger_score)'}],
                'row_limit': 30
            }
        },
        {
            'name': 'Teen Behavior Patterns',
            'viz': 'pie',
            'table': 'kaggle_teen_behavior_patterns',
            'params': {
                'groupby': ['behavior_type'],
                'metrics': [{'label': 'Count', 'expression': 'COUNT(*)'}],
                'row_limit': 15
            }
        },
        {
            'name': 'Social Media Usage by Country',
            'viz': 'bar',
            'table': 'kaggle_social_media_usage',
            'params': {
                'groupby': ['country'],
                'metrics': [{'label': 'Avg Daily Usage', 'expression': 'AVG(daily_usage_minutes)'}],
                'row_limit': 30
            }
        }
    ]
    
    created_charts = []
    for chart_data in charts_data:
        chart = Chart(
            chart_name=chart_data['name'],
            viz_type=chart_data['viz'],
            params=chart_data['params'],
            query_context=chart_data['params'],
            description=f'Chart from Kaggle dataset: {chart_data["table"]}',
            datasource_id=db_conn.id,
            datasource_type='table',
            owner_id=1
        )
        db.session.add(chart)
        db.session.flush()
        created_charts.append(chart)
        print(f'Created chart: {chart.chart_name} (id={chart.id})')
    
    db.session.commit()
    
    dashboard = Dashboard(
        dashboard_title='Kaggle Social Media & Mental Health Dashboard',
        description='Comprehensive dashboard analyzing social media addiction and mental health trends from Kaggle dataset',
        owner_id=1,
        position_json='{}',
        json_metadata={'native_filter_configuration': []}
    )
    db.session.add(dashboard)
    db.session.flush()
    print(f'Created dashboard: {dashboard.dashboard_title} (id={dashboard.id})')
    
    for i, chart in enumerate(created_charts):
        position = {
            'type': 'CHART',
            'id': f'CHART-{i+1}',
            'children': [],
            'meta': {
                'chartId': chart.id,
                'width': 6,
                'height': 50,
                'tabName': 'Main'
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
    print(f'Added {len(created_charts)} charts to dashboard')
    print('Done!')
