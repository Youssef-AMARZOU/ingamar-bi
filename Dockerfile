FROM python:3.11-slim

LABEL org.opencontainers.image.source="https://github.com/Youssef-AMARZOU/ingamar-bi"
LABEL org.opencontainers.image.description="INGAMAR BI - Enterprise Business Intelligence Platform with AI/ML"
LABEL org.opencontainers.image.title="INGAMAR BI"
LABEL org.opencontainers.image.licenses="GPL-2.0"

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app:create_app
ENV FLASK_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends gcc build-essential && rm -rf /var/lib/apt/lists/*

COPY requirements.txt backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x start.sh

EXPOSE 7860

CMD ["./start.sh"]
