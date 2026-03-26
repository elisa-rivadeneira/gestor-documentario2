"""
API REST para Sistema de Gestión de Correspondencia Institucional
FastAPI + SQLite + Claude IA
"""
import os
import re
import shutil
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import pdfplumber

from database import engine, get_db, Base
from models import Documento, Adjunto, Usuario, Contrato, AdjuntoContrato, ComisariaContrato
from schemas import (
    DocumentoCreate, DocumentoUpdate, DocumentoResponse, DocumentoListResponse,
    AdjuntoCreate, AdjuntoResponse, AnalisisIARequest, AnalisisIAResponse,
    LoginRequest, LoginResponse, UsuarioResponse,
    ContratoCreate, ContratoUpdate, ContratoResponse, ContratoListResponse,
    AdjuntoContratoResponse
)
from services.ia_service import ia_service, extraer_numero_con_ocr, OCR_DISPONIBLE
from services.auth_service import hash_password, verify_password, create_token, verify_token
from init_users import crear_usuarios_iniciales

# Crear tablas en la base de datos
Base.metadata.create_all(bind=engine)

# Migración: agregar columnas nuevas a contratos si no existen
def migrar_contratos():
    """Agrega columnas nuevas a la tabla contratos si no existen.
    - ruc_contratado: NULL por defecto
    - tipo_contrato: 'mantenimiento' por defecto para registros existentes
    - precio_unitario: NULL por defecto (solo para equipamiento)
    - monto_total: convertir de TEXT a REAL si es necesario
    """
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            # Verificar columnas existentes
            result = conn.execute(text("PRAGMA table_info(contratos)"))
            columnas_info = result.fetchall()
            columnas = [row[1] for row in columnas_info]

            # Agregar columna ruc_contratado (NULL por defecto)
            if 'ruc_contratado' not in columnas:
                conn.execute(text("ALTER TABLE contratos ADD COLUMN ruc_contratado VARCHAR(11)"))
                conn.commit()
                print("Migración completada: columna ruc_contratado agregada (NULL por defecto)")

            # Agregar columna tipo_contrato
            if 'tipo_contrato' not in columnas:
                conn.execute(text("ALTER TABLE contratos ADD COLUMN tipo_contrato VARCHAR(20)"))
                conn.commit()
                print("Migración completada: columna tipo_contrato agregada")

            # Agregar columna precio_unitario (NULL por defecto, solo para equipamiento)
            if 'precio_unitario' not in columnas:
                conn.execute(text("ALTER TABLE contratos ADD COLUMN precio_unitario REAL"))
                conn.commit()
                print("Migración completada: columna precio_unitario agregada (NULL por defecto)")

            # Agregar columna plazo_dias
            if 'plazo_dias' not in columnas:
                conn.execute(text("ALTER TABLE contratos ADD COLUMN plazo_dias INTEGER"))
                conn.commit()
                print("Migración completada: columna plazo_dias agregada")

            # Agregar columna dias_adicionales (0 por defecto)
            if 'dias_adicionales' not in columnas:
                conn.execute(text("ALTER TABLE contratos ADD COLUMN dias_adicionales INTEGER DEFAULT 0"))
                conn.commit()
                print("Migración completada: columna dias_adicionales agregada (0 por defecto)")

            # Agregar columna estado_ejecucion (PENDIENTE por defecto)
            if 'estado_ejecucion' not in columnas:
                conn.execute(text("ALTER TABLE contratos ADD COLUMN estado_ejecucion VARCHAR(30) DEFAULT 'PENDIENTE'"))
                conn.commit()
                print("Migración completada: columna estado_ejecucion agregada (PENDIENTE por defecto)")

            # Establecer 'mantenimiento' como valor por defecto para contratos existentes sin tipo
            result = conn.execute(text("UPDATE contratos SET tipo_contrato = 'mantenimiento' WHERE tipo_contrato IS NULL"))
            if result.rowcount > 0:
                conn.commit()
                print(f"Migración completada: {result.rowcount} contratos actualizados a tipo 'mantenimiento'")

            # Convertir monto_total de texto a número (extraer solo dígitos y decimales)
            # Solo ejecutar si hay datos con formato texto
            try:
                conn.execute(text("""
                    UPDATE contratos
                    SET monto_total = CAST(
                        REPLACE(REPLACE(REPLACE(monto_total, 'S/', ''), ',', ''), ' ', '')
                        AS REAL
                    )
                    WHERE monto_total IS NOT NULL
                    AND monto_total != ''
                    AND typeof(monto_total) = 'text'
                """))
                conn.commit()
            except:
                pass  # Ignorar si ya es numérico o hay error de conversión

    except Exception as e:
        print(f"Error en migración (puede ignorarse si es nueva instalación): {e}")

migrar_contratos()

# Crear usuarios iniciales si no existen
crear_usuarios_iniciales()

# Crear aplicación FastAPI
app = FastAPI(
    title="Sistema de Gestión de Correspondencia",
    description="MVP para gestión de oficios y cartas institucionales",
    version="1.0.0"
)

# Configurar CORS para permitir frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio para archivos subidos (usa variable de entorno en producción)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Montar directorio de uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ============================================
# AUTENTICACIÓN
# ============================================

def verificar_admin(authorization: Optional[str] = Header(None)) -> Usuario:
    """
    Dependency para verificar que el usuario está autenticado.
    Extrae el token del header Authorization.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="No autorizado - Token requerido")

    # Extraer token del header "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Esquema de autorización inválido")
    except ValueError:
        raise HTTPException(status_code=401, detail="Header de autorización inválido")

    # Verificar token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    return payload


def verificar_admin_opcional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Dependency opcional - no falla si no hay token, solo retorna None.
    Útil para endpoints que pueden ser públicos o autenticados.
    """
    if not authorization:
        return None

    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            return None
        payload = verify_token(token)
        return payload
    except:
        return None


@app.post("/api/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Endpoint de login. Verifica credenciales y retorna token JWT.
    """
    # Buscar usuario
    usuario = db.query(Usuario).filter(Usuario.username == request.username).first()

    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    if not usuario.activo:
        raise HTTPException(status_code=401, detail="Usuario desactivado")

    # Verificar contraseña
    if not verify_password(request.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Generar token
    token = create_token(usuario.username, usuario.nombre)

    return LoginResponse(
        token=token,
        usuario=usuario.username,
        nombre=usuario.nombre,
        mensaje="Login exitoso"
    )


@app.get("/api/verificar-token")
def verificar_token_endpoint(admin: dict = Depends(verificar_admin)):
    """
    Verifica si el token actual es válido.
    """
    return {
        "valido": True,
        "usuario": admin.get("sub"),
        "nombre": admin.get("nombre")
    }


# ============================================
# ENDPOINTS DE DOCUMENTOS
# ============================================

@app.get("/api/documentos", response_model=DocumentoListResponse)
def listar_documentos(
    tipo_documento: Optional[str] = Query(None, description="Filtrar por tipo: oficio, carta"),
    direccion: Optional[str] = Query(None, description="Filtrar por dirección: recibido, enviado"),
    busqueda: Optional[str] = Query(None, description="Búsqueda en título, asunto, remitente, destinatario"),
    ordenar_por: Optional[str] = Query(None, description="Ordenar por: numero, fecha"),
    pagina: int = Query(1, ge=1, description="Número de página"),
    por_pagina: int = Query(20, ge=1, le=100, description="Documentos por página"),
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)  # Requiere autenticación
):
    """
    Lista documentos con filtros opcionales y paginación.
    Retorna bandeja unificada de correspondencia.
    """
    query = db.query(Documento)

    # Aplicar filtros
    if tipo_documento:
        query = query.filter(Documento.tipo_documento == tipo_documento)
    if direccion:
        query = query.filter(Documento.direccion == direccion)
    if busqueda:
        busqueda_like = f"%{busqueda}%"
        query = query.filter(
            or_(
                Documento.titulo.ilike(busqueda_like),
                Documento.asunto.ilike(busqueda_like),
                Documento.remitente.ilike(busqueda_like),
                Documento.destinatario.ilike(busqueda_like),
                Documento.numero.ilike(busqueda_like)
            )
        )

    # Contar total
    total = query.count()

    # Aplicar ordenamiento según parámetro
    if ordenar_por == 'fecha':
        # Ordenar por fecha del documento y luego por fecha de subida (más recientes primero)
        documentos = query.order_by(
            Documento.fecha.desc().nullslast(),
            Documento.created_at.desc()
        ).offset((pagina - 1) * por_pagina)\
            .limit(por_pagina)\
            .all()
    else:
        # Ordenar por año y correlativo (más nuevos primero) - default para oficios y cartas nemaec
        documentos = query.order_by(
            Documento.anio_oficio.desc().nullslast(),
            Documento.correlativo_oficio.desc().nullslast(),
            Documento.created_at.desc()
        ).offset((pagina - 1) * por_pagina)\
            .limit(por_pagina)\
            .all()

    return DocumentoListResponse(
        documentos=documentos,
        total=total,
        pagina=pagina,
        por_pagina=por_pagina
    )


@app.post("/api/documentos", response_model=DocumentoResponse, status_code=201)
def crear_documento(
    documento: DocumentoCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """
    Crea un nuevo documento (oficio o carta).
    Requiere autenticación de admin.
    """
    # Validar que no exista un documento con el mismo número
    if documento.numero:
        existente = db.query(Documento).filter(Documento.numero == documento.numero).first()
        if existente:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un documento con el número {documento.numero}"
            )

    # Validar documento padre si se especifica
    if documento.documento_padre_id:
        padre = db.query(Documento).filter(Documento.id == documento.documento_padre_id).first()
        if not padre:
            raise HTTPException(status_code=404, detail="Documento padre no encontrado")

    # Extraer año y correlativo para ordenamiento
    anio_oficio = None
    correlativo_oficio = None
    if documento.numero:
        import re
        match_correlativo = re.search(r'(\d{3,6})', documento.numero)
        correlativo_oficio = int(match_correlativo.group(1)) if match_correlativo else None
        match_anio = re.search(r'(202[4-9])', documento.numero)
        anio_oficio = int(match_anio.group(1)) if match_anio else None

    db_documento = Documento(
        **documento.model_dump(),
        anio_oficio=anio_oficio,
        correlativo_oficio=correlativo_oficio
    )
    db.add(db_documento)
    db.commit()
    db.refresh(db_documento)
    return db_documento


@app.get("/api/documentos/{documento_id}", response_model=DocumentoResponse)
def obtener_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)  # Requiere autenticación
):
    """
    Obtiene un documento por su ID con todos sus adjuntos.
    Requiere autenticación.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return documento


@app.put("/api/documentos/{documento_id}", response_model=DocumentoResponse)
def actualizar_documento(
    documento_id: int,
    documento_update: DocumentoUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """
    Actualiza un documento existente.
    Requiere autenticación de admin.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Actualizar campos proporcionados
    update_data = documento_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(documento, field, value)

    documento.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(documento)
    return documento


@app.delete("/api/documentos/{documento_id}", status_code=204)
def eliminar_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """
    Elimina un documento y sus adjuntos.
    Requiere autenticación de admin.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Eliminar archivo local si existe
    if documento.archivo_local:
        archivo_path = os.path.join(UPLOAD_DIR, documento.archivo_local)
        if os.path.exists(archivo_path):
            os.remove(archivo_path)

    db.delete(documento)
    db.commit()
    return None


@app.get("/api/documentos/{documento_id}/respuestas", response_model=List[DocumentoResponse])
def obtener_respuestas(
    documento_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)  # Requiere autenticación
):
    """
    Obtiene las cartas enviadas como respuesta a un documento.
    Requiere autenticación.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    respuestas = db.query(Documento).filter(
        Documento.documento_padre_id == documento_id
    ).all()

    return respuestas


# ============================================
# ENDPOINTS DE ARCHIVOS
# ============================================

@app.post("/api/documentos/{documento_id}/archivo")
async def subir_archivo(
    documento_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """
    Sube un archivo PDF a un documento existente.
    Requiere autenticación de admin.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Validar tipo de archivo
    if not archivo.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    # Generar nombre único
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"{documento_id}_{timestamp}_{archivo.filename}"
    ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

    # Guardar archivo
    with open(ruta_archivo, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    # Actualizar documento
    documento.archivo_local = nombre_archivo
    documento.updated_at = datetime.utcnow()
    db.commit()

    return {
        "mensaje": "Archivo subido exitosamente",
        "archivo": nombre_archivo,
        "ruta": f"/uploads/{nombre_archivo}"
    }


@app.post("/api/subir-temporal")
async def subir_archivo_temporal(
    archivo: UploadFile = File(...),
    admin: dict = Depends(verificar_admin)
):
    """
    Sube un archivo temporalmente para análisis antes de crear el documento.
    Requiere autenticación de admin.
    """
    if not archivo.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    # Generar nombre único temporal
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"temp_{timestamp}_{archivo.filename}"
    ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

    # Guardar archivo
    with open(ruta_archivo, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    return {
        "mensaje": "Archivo subido temporalmente",
        "archivo": nombre_archivo,
        "ruta": f"/uploads/{nombre_archivo}"
    }


@app.post("/api/documentos/{documento_id}/asociar-archivo")
async def asociar_archivo_temporal(
    documento_id: int,
    nombre_temporal: str = Query(..., description="Nombre del archivo temporal a asociar"),
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """
    Asocia un archivo temporal ya subido a un documento.
    Renombra el archivo con el ID del documento.
    Requiere autenticación de admin.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Verificar que el archivo temporal existe
    ruta_temporal = os.path.join(UPLOAD_DIR, nombre_temporal)
    if not os.path.exists(ruta_temporal):
        raise HTTPException(status_code=404, detail="Archivo temporal no encontrado")

    # Generar nuevo nombre con el ID del documento
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # Extraer el nombre original del archivo (quitar prefijo temp_YYYYMMDD_HHMMSS_)
    # El formato temporal es: temp_20260122_203103_NombreOriginal.pdf
    partes = nombre_temporal.split('_', 3)
    nombre_original = partes[3] if len(partes) > 3 else nombre_temporal
    nuevo_nombre = f"{documento_id}_{timestamp}_{nombre_original}"
    ruta_nueva = os.path.join(UPLOAD_DIR, nuevo_nombre)

    # Renombrar archivo
    os.rename(ruta_temporal, ruta_nueva)

    # Actualizar documento
    documento.archivo_local = nuevo_nombre
    documento.updated_at = datetime.utcnow()
    db.commit()

    return {
        "mensaje": "Archivo asociado exitosamente",
        "archivo": nuevo_nombre,
        "ruta": f"/uploads/{nuevo_nombre}"
    }


# ============================================
# ENDPOINTS DE ANÁLISIS IA
# ============================================

@app.post("/api/analizar-ia", response_model=AnalisisIAResponse)
async def analizar_con_ia(
    request: AnalisisIARequest,
    admin: dict = Depends(verificar_admin)
):
    """
    Analiza texto con IA y genera título, asunto y resumen.
    Recibe texto directamente.
    Requiere autenticación de admin.
    """
    if not request.texto:
        raise HTTPException(status_code=400, detail="Se requiere texto para analizar")

    resultado = ia_service.analizar_documento(request.texto)
    return AnalisisIAResponse(**resultado)


@app.post("/api/analizar-archivo/{nombre_archivo}", response_model=AnalisisIAResponse)
async def analizar_archivo_con_ia(
    nombre_archivo: str,
    admin: dict = Depends(verificar_admin)
):
    """
    Extrae texto de un PDF y lo analiza con IA.
    Usa OCR como fallback si no se puede extraer el número de oficio.
    Requiere autenticación de admin.
    """
    ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

    if not os.path.exists(ruta_archivo):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # Extraer texto del PDF
    try:
        texto = extraer_texto_pdf(ruta_archivo)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer PDF: {str(e)}")

    if not texto or len(texto.strip()) < 50:
        return AnalisisIAResponse(
            numero_oficio="",
            fecha="",
            remitente="",
            destinatario="",
            asunto="",
            resumen="",
            exito=False,
            mensaje="No se pudo extraer suficiente texto del PDF"
        )

    # Agregar el nombre del archivo al inicio del texto para ayudar a la IA
    # El nombre del archivo suele contener el número de oficio
    nombre_original = nombre_archivo.split('_', 3)[-1] if '_' in nombre_archivo else nombre_archivo
    texto_con_nombre = f"NOMBRE DEL ARCHIVO: {nombre_original}\n\n{texto}"

    # Detectar si necesitamos OCR prioritario:
    # 1. Nombre de archivo corto de Windows (contiene ~)
    # 2. El texto tiene "OFICIO N°" pero sin número visible (ej: "OFICIO N° -2026")
    nombre_es_corto_windows = '~' in nombre_original
    texto_sin_numero_encabezado = bool(re.search(r'OFICIO\s*N[°º]?\s*-\s*\d{4}', texto, re.IGNORECASE))

    necesita_ocr_prioritario = nombre_es_corto_windows or texto_sin_numero_encabezado

    # Si necesitamos OCR prioritario y está disponible, extraer número con OCR primero
    numero_ocr = ""
    if necesita_ocr_prioritario and OCR_DISPONIBLE:
        print(f"Nombre corto Windows o texto sin número en encabezado detectado, usando OCR prioritario...")
        numero_ocr = extraer_numero_con_ocr(ruta_archivo)
        print(f"OCR encontró: '{numero_ocr}'")

    # Analizar con IA
    resultado = ia_service.analizar_documento(texto_con_nombre)

    # Si OCR prioritario encontró un número, usarlo (tiene prioridad sobre la IA)
    if numero_ocr:
        resultado["numero_oficio"] = numero_ocr
        resultado["mensaje_whatsapp"] = f"{numero_ocr}\nAsunto: {resultado.get('asunto', '')}\nResumen: {resultado.get('resumen', '')}"
        resultado["mensaje"] = "Análisis completado (número extraído con OCR)"
    else:
        # Verificar si el número de oficio tiene el formato correcto
        # Acepta 5-6 dígitos para oficios O 1-6 dígitos para cartas NEMAEC O carta genérica
        numero_actual = resultado.get("numero_oficio", "")
        es_nemaec = "NEMAEC" in numero_actual.upper()
        es_carta = "CARTA" in numero_actual.upper()
        tiene_numero_valido = bool(re.search(r'\d{5,6}', numero_actual)) or (es_nemaec and bool(re.search(r'\d{1,6}', numero_actual))) or (es_carta and bool(re.search(r'\d{1,6}', numero_actual)))

        # Si no se encontró número válido y OCR está disponible, intentar con OCR
        if not tiene_numero_valido and OCR_DISPONIBLE:
            print(f"Número de oficio incompleto o no encontrado: '{numero_actual}', intentando OCR...")
            numero_ocr = extraer_numero_con_ocr(ruta_archivo)
            if numero_ocr:
                resultado["numero_oficio"] = numero_ocr
                # Actualizar mensaje WhatsApp con el número encontrado por OCR
                resultado["mensaje_whatsapp"] = f"{numero_ocr}\nAsunto: {resultado.get('asunto', '')}\nResumen: {resultado.get('resumen', '')}"
                resultado["mensaje"] = "Análisis completado (número extraído con OCR)"

    return AnalisisIAResponse(**resultado)


def extraer_texto_pdf(ruta: str) -> str:
    """
    Extrae texto de un archivo PDF usando pdfplumber (mejor extracción).
    """
    texto = ""
    with pdfplumber.open(ruta) as pdf:
        for page in pdf.pages:
            texto += page.extract_text() or ""
    return texto


# ============================================
# ENDPOINTS DE ADJUNTOS
# ============================================

@app.post("/api/documentos/{documento_id}/adjuntos", response_model=AdjuntoResponse)
async def agregar_adjunto(
    documento_id: int,
    archivo: UploadFile = File(None),
    enlace_drive: str = Query(None),
    nombre: str = Query(None),
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """
    Agrega un adjunto a un documento (archivo o enlace Drive).
    Requiere autenticación de admin.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    adjunto_data = {"documento_id": documento_id}

    if archivo:
        # Subir archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_archivo = f"adj_{documento_id}_{timestamp}_{archivo.filename}"
        ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

        with open(ruta_archivo, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

        adjunto_data["archivo_local"] = nombre_archivo
        adjunto_data["nombre"] = nombre or archivo.filename
    elif enlace_drive:
        adjunto_data["enlace_drive"] = enlace_drive
        adjunto_data["nombre"] = nombre or "Enlace Drive"
    else:
        raise HTTPException(status_code=400, detail="Se requiere archivo o enlace Drive")

    adjunto = Adjunto(**adjunto_data)
    db.add(adjunto)
    db.commit()
    db.refresh(adjunto)
    return adjunto


@app.delete("/api/adjuntos/{adjunto_id}", status_code=204)
def eliminar_adjunto(
    adjunto_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """
    Elimina un adjunto.
    Requiere autenticación de admin.
    """
    adjunto = db.query(Adjunto).filter(Adjunto.id == adjunto_id).first()
    if not adjunto:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")

    # Eliminar archivo si existe
    if adjunto.archivo_local:
        ruta = os.path.join(UPLOAD_DIR, adjunto.archivo_local)
        if os.path.exists(ruta):
            os.remove(ruta)

    db.delete(adjunto)
    db.commit()
    return None


# ============================================
# ENDPOINTS DE CONTRATOS
# ============================================

@app.get("/api/contratos", response_model=ContratoListResponse)
def listar_contratos(
    busqueda: Optional[str] = Query(None, description="Búsqueda en contratante, contratado, item, asunto, número"),
    tipo_contrato: Optional[str] = Query(None, description="Filtrar por tipo: equipamiento,mantenimiento (separados por coma)"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lista contratos con búsqueda opcional y paginación."""
    query = db.query(Contrato)

    # Filtrar por tipo de contrato
    if tipo_contrato:
        tipos = [t.strip() for t in tipo_contrato.split(',') if t.strip()]
        if tipos:
            query = query.filter(Contrato.tipo_contrato.in_(tipos))

    if busqueda:
        busqueda_like = f"%{busqueda}%"
        query = query.filter(
            or_(
                Contrato.contratante.ilike(busqueda_like),
                Contrato.contratado.ilike(busqueda_like),
                Contrato.item_contratado.ilike(busqueda_like),
                Contrato.asunto.ilike(busqueda_like),
                Contrato.numero.ilike(busqueda_like)
            )
        )

    total = query.count()
    contratos = query.order_by(Contrato.created_at.desc())\
        .offset((pagina - 1) * por_pagina)\
        .limit(por_pagina)\
        .all()

    return ContratoListResponse(
        contratos=contratos,
        total=total,
        pagina=pagina,
        por_pagina=por_pagina
    )


@app.post("/api/contratos", response_model=ContratoResponse, status_code=201)
def crear_contrato(
    contrato: ContratoCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """Crea un nuevo contrato. Requiere autenticación."""
    # Extraer comisarías del payload
    comisarias_data = contrato.comisarias
    contrato_dict = contrato.model_dump(exclude={'comisarias'})

    # Crear el contrato
    db_contrato = Contrato(**contrato_dict)
    db.add(db_contrato)
    db.commit()
    db.refresh(db_contrato)

    # Si es mantenimiento y hay comisarías, crearlas
    if contrato.tipo_contrato == 'mantenimiento' and comisarias_data:
        for comisaria in comisarias_data:
            db_comisaria = ComisariaContrato(
                contrato_id=db_contrato.id,
                nombre_cpnp=comisaria.nombre_cpnp,
                monto=comisaria.monto
            )
            db.add(db_comisaria)
        db.commit()
        db.refresh(db_contrato)

    return db_contrato


@app.get("/api/contratos/{contrato_id}", response_model=ContratoResponse)
def obtener_contrato(contrato_id: int, db: Session = Depends(get_db)):
    """Obtiene un contrato por su ID con todos sus adjuntos."""
    contrato = db.query(Contrato).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return contrato


@app.put("/api/contratos/{contrato_id}", response_model=ContratoResponse)
def actualizar_contrato(
    contrato_id: int,
    contrato_update: ContratoUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """Actualiza un contrato existente. Requiere autenticación."""
    contrato = db.query(Contrato).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    # Extraer comisarías del payload
    comisarias_data = contrato_update.comisarias
    update_data = contrato_update.model_dump(exclude_unset=True, exclude={'comisarias'})

    for field, value in update_data.items():
        setattr(contrato, field, value)

    # Si se envían comisarías, reemplazar las existentes
    if comisarias_data is not None:
        # Eliminar comisarías existentes
        db.query(ComisariaContrato).filter(ComisariaContrato.contrato_id == contrato_id).delete()

        # Crear nuevas comisarías
        for comisaria in comisarias_data:
            db_comisaria = ComisariaContrato(
                contrato_id=contrato_id,
                nombre_cpnp=comisaria.nombre_cpnp,
                monto=comisaria.monto
            )
            db.add(db_comisaria)

    contrato.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contrato)
    return contrato


@app.delete("/api/contratos/{contrato_id}", status_code=204)
def eliminar_contrato(
    contrato_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """Elimina un contrato y sus adjuntos. Requiere autenticación."""
    contrato = db.query(Contrato).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    if contrato.archivo_local:
        archivo_path = os.path.join(UPLOAD_DIR, contrato.archivo_local)
        if os.path.exists(archivo_path):
            os.remove(archivo_path)

    # Eliminar archivos de adjuntos
    for adj in contrato.adjuntos:
        if adj.archivo_local:
            ruta = os.path.join(UPLOAD_DIR, adj.archivo_local)
            if os.path.exists(ruta):
                os.remove(ruta)

    db.delete(contrato)
    db.commit()
    return None


@app.post("/api/contratos/{contrato_id}/asociar-archivo")
async def asociar_archivo_contrato(
    contrato_id: int,
    nombre_temporal: str = Query(..., description="Nombre del archivo temporal a asociar"),
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """Asocia un archivo temporal ya subido a un contrato."""
    contrato = db.query(Contrato).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    ruta_temporal = os.path.join(UPLOAD_DIR, nombre_temporal)
    if not os.path.exists(ruta_temporal):
        raise HTTPException(status_code=404, detail="Archivo temporal no encontrado")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    partes = nombre_temporal.split('_', 3)
    nombre_original = partes[3] if len(partes) > 3 else nombre_temporal
    nuevo_nombre = f"contrato_{contrato_id}_{timestamp}_{nombre_original}"
    ruta_nueva = os.path.join(UPLOAD_DIR, nuevo_nombre)

    # Eliminar archivo anterior si existe
    if contrato.archivo_local:
        ruta_anterior = os.path.join(UPLOAD_DIR, contrato.archivo_local)
        if os.path.exists(ruta_anterior):
            os.remove(ruta_anterior)

    os.rename(ruta_temporal, ruta_nueva)

    contrato.archivo_local = nuevo_nombre
    contrato.updated_at = datetime.utcnow()
    db.commit()

    return {
        "mensaje": "Archivo asociado exitosamente",
        "archivo": nuevo_nombre,
        "ruta": f"/uploads/{nuevo_nombre}"
    }


@app.post("/api/contratos/{contrato_id}/adjuntos", response_model=AdjuntoContratoResponse)
async def agregar_adjunto_contrato(
    contrato_id: int,
    archivo: UploadFile = File(None),
    enlace_drive: str = Query(None),
    nombre: str = Query(None),
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """Agrega un adjunto a un contrato (archivo o enlace Drive)."""
    contrato = db.query(Contrato).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    adjunto_data = {"contrato_id": contrato_id}

    if archivo:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_archivo = f"adj_contrato_{contrato_id}_{timestamp}_{archivo.filename}"
        ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

        with open(ruta_archivo, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

        adjunto_data["archivo_local"] = nombre_archivo
        adjunto_data["nombre"] = nombre or archivo.filename
    elif enlace_drive:
        adjunto_data["enlace_drive"] = enlace_drive
        adjunto_data["nombre"] = nombre or "Enlace Drive"
    else:
        raise HTTPException(status_code=400, detail="Se requiere archivo o enlace Drive")

    adjunto = AdjuntoContrato(**adjunto_data)
    db.add(adjunto)
    db.commit()
    db.refresh(adjunto)
    return adjunto


@app.delete("/api/adjuntos-contrato/{adjunto_id}", status_code=204)
def eliminar_adjunto_contrato(
    adjunto_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(verificar_admin)
):
    """Elimina un adjunto de contrato."""
    adjunto = db.query(AdjuntoContrato).filter(AdjuntoContrato.id == adjunto_id).first()
    if not adjunto:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")

    if adjunto.archivo_local:
        ruta = os.path.join(UPLOAD_DIR, adjunto.archivo_local)
        if os.path.exists(ruta):
            os.remove(ruta)

    db.delete(adjunto)
    db.commit()
    return None


# ============================================
# ENDPOINT DE RESTAURACIÓN DE UPLOADS
# ============================================

@app.post("/api/restaurar-uploads")
async def restaurar_uploads(
    archivo: UploadFile = File(...),
    admin: dict = Depends(verificar_admin)
):
    """
    Restaura archivos de uploads desde un ZIP.
    Solo admin puede usar este endpoint.
    """
    import zipfile
    import io

    if not archivo.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos ZIP")

    # Leer el ZIP
    contenido = await archivo.read()

    try:
        archivos_restaurados = []
        with zipfile.ZipFile(io.BytesIO(contenido), 'r') as zip_ref:
            for nombre in zip_ref.namelist():
                # Ignorar directorios y archivos ocultos
                if nombre.endswith('/') or nombre.startswith('.') or '/' in nombre:
                    continue

                # Extraer solo archivos PDF
                if nombre.lower().endswith('.pdf'):
                    ruta_destino = os.path.join(UPLOAD_DIR, nombre)
                    # Solo extraer si no existe (no sobrescribir)
                    if not os.path.exists(ruta_destino):
                        with zip_ref.open(nombre) as src, open(ruta_destino, 'wb') as dst:
                            dst.write(src.read())
                        archivos_restaurados.append(nombre)

        return {
            "mensaje": f"Restauración completada",
            "archivos_restaurados": len(archivos_restaurados),
            "lista": archivos_restaurados[:20]  # Mostrar máximo 20
        }
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Archivo ZIP inválido")


# ============================================
# ENDPOINT DE SALUD
# ============================================

@app.get("/api/health")
def health_check():
    """Verificar estado del servidor"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ============================================
# ENDPOINT DE CONSULTA RUC (SUNAT)
# ============================================

@app.get("/api/consultar-ruc/{ruc}")
async def consultar_ruc(ruc: str, admin: dict = Depends(verificar_admin)):
    """
    Consulta la razón social de un RUC en SUNAT.
    Usa la API gratuita de apis.net.pe
    Requiere autenticación.
    """
    import httpx

    # Validar formato de RUC (11 dígitos)
    if not ruc.isdigit() or len(ruc) != 11:
        raise HTTPException(status_code=400, detail="El RUC debe tener exactamente 11 dígitos")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Usar API gratuita de apis.net.pe
            response = await client.get(f"https://api.apis.net.pe/v1/ruc?numero={ruc}")

            if response.status_code == 200:
                data = response.json()
                return {
                    "exito": True,
                    "ruc": data.get("numeroDocumento", ruc),
                    "razon_social": data.get("nombre", ""),
                    "estado": data.get("estado", ""),
                    "condicion": data.get("condicion", ""),
                    "direccion": data.get("direccion", ""),
                    "departamento": data.get("departamento", ""),
                    "provincia": data.get("provincia", ""),
                    "distrito": data.get("distrito", "")
                }
            elif response.status_code == 404:
                return {
                    "exito": False,
                    "mensaje": "RUC no encontrado en SUNAT"
                }
            else:
                return {
                    "exito": False,
                    "mensaje": f"Error al consultar SUNAT: {response.status_code}"
                }
    except httpx.TimeoutException:
        return {
            "exito": False,
            "mensaje": "Tiempo de espera agotado al consultar SUNAT"
        }
    except Exception as e:
        return {
            "exito": False,
            "mensaje": f"Error de conexión: {str(e)}"
        }


# ============================================
# SERVIR FRONTEND
# ============================================

# Directorio del frontend
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# Montar archivos estáticos del frontend (CSS, JS)
if os.path.exists(FRONTEND_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

@app.get("/favicon.ico")
async def serve_favicon():
    """Servir el favicon"""
    favicon_path = os.path.join(FRONTEND_DIR, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    return None

@app.get("/")
async def serve_frontend():
    """Servir el frontend"""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend no encontrado", "api_docs": "/docs"}


# ============================================
# PUNTO DE ENTRADA
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
