#!/bin/bash

mkdir -p /data
mkdir -p /data/uploads

echo "Iniciando servidor..."
cd /app/backend
exec uvicorn main:app --host 0.0.0.0 --port 8000
