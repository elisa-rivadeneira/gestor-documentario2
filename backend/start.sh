#!/bin/bash

DATA_DIR="/data"
DB_FILE="$DATA_DIR/correspondencia.db"
INITIAL_DB="/app/correspondencia.db.initial"
UPLOADS_DIR="$DATA_DIR/uploads"

mkdir -p $DATA_DIR
mkdir -p $UPLOADS_DIR

if [ -f "$INITIAL_DB" ]; then
    INITIAL_HASH=$(md5sum "$INITIAL_DB" | cut -d' ' -f1)
    CURRENT_HASH=$(md5sum "$DB_FILE" 2>/dev/null | cut -d' ' -f1)
    if [ "$INITIAL_HASH" != "$CURRENT_HASH" ]; then
        echo "Nueva versión de base de datos detectada, actualizando..."
        cp "$INITIAL_DB" "$DB_FILE"
        echo "Base de datos actualizada"
    else
        echo "Base de datos ya está al día"
    fi
else
    echo "No hay base de datos inicial en la imagen"
fi

echo "Iniciando servidor..."
cd /app/backend
exec uvicorn main:app --host 0.0.0.0 --port 8000
