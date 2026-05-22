FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Create upload directory
RUN mkdir -p /tmp/ingamar/uploads

EXPOSE 8088

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8088", "--timeout", "120", "app:create_app()"]
