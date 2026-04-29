#!/bin/bash

DATA_DIR="/data"
DB_FILE="$DATA_DIR/correspondencia.db"
INITIAL_DB="/app/correspondencia.db.initial"
UPLOADS_DIR="$DATA_DIR/uploads"

mkdir -p $DATA_DIR
mkdir -p $UPLOADS_DIR

if [ ! -f "$DB_FILE" ]; then
    if [ -f "$INITIAL_DB" ]; then
        echo "Copiando base de datos inicial..."
        cp "$INITIAL_DB" "$DB_FILE"
    else
        echo "No hay base de datos inicial, se creará una nueva"
    fi
else
    echo "Base de datos existente encontrada, no se toca"
fi

echo "Iniciando servidor..."
cd /app/backend
exec uvicorn main:app --host 0.0.0.0 --port 8000
