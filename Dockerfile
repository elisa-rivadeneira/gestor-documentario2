# Dockerfile para Sistema de Gestión Documentaria
FROM python:3.11-slim

# Instalar dependencias del sistema para OCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Copiar requirements primero (para cache de Docker)
COPY backend/requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend/ ./backend/

# Copiar frontend
COPY frontend/ ./frontend/

# Crear directorios necesarios
RUN mkdir -p /data/uploads

# Hacer ejecutable el script de inicio
RUN chmod +x /app/backend/start.sh

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV UPLOAD_DIR=/data/uploads
ENV DATABASE_PATH=/data/correspondencia.db

# Exponer puerto
EXPOSE 8000

# Comando para iniciar el servidor (usa el script que verifica la BD)
CMD ["/app/backend/start.sh"]
