# Multi-stage Dockerfile for AetherLink web application

# Frontend build stage
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY frontend/ ./

# Build frontend
RUN npm run build

# Backend base stage
FROM python:3.11-slim AS backend-base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python dependencies from backend-base
COPY --from=backend-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-base /usr/local/bin /usr/local/bin

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./backend/frontend/dist/

# Copy existing hardware modules
COPY back_end/ ./back_end/

# Create non-root user
RUN groupadd -r aetherlink && useradd --no-log-init -r -g aetherlink aetherlink

# Create data directory for database
RUN mkdir -p /app/data /app/logs /app/config && \
    chown -R aetherlink:aetherlink /app

# Switch to non-root user
USER aetherlink

# Expose port
EXPOSE 9000

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:9000/api/health')"

# Start application
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "9000"]