from celery import Celery
from config import Config

celery_app = Celery(
    'ingamar',
    broker=Config.CELERY_BROKER_URL if 'redis' in Config.CELERY_BROKER_URL else 'sqla+sqlite:///ingamar.db',
    backend=Config.CELERY_RESULT_BACKEND if 'redis' in Config.CELERY_RESULT_BACKEND else 'db+sqlite:///ingamar.db',
    include=['app.tasks']
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    broker_transport_options={'visibility_timeout': 3600},
)
