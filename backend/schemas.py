"""
Schemas Pydantic para validación de datos de entrada/salida
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class TipoDocumentoEnum(str, Enum):
    OFICIO = "oficio"
    CARTA = "carta"


class DireccionEnum(str, Enum):
    RECIBIDO = "recibido"
    ENVIADO = "enviado"


# === Schemas para Adjuntos ===

class AdjuntoBase(BaseModel):
    nombre: str
    enlace_drive: Optional[str] = None
    archivo_local: Optional[str] = None


class AdjuntoCreate(AdjuntoBase):
    pass


class AdjuntoResponse(AdjuntoBase):
    id: int
    documento_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Documentos ===

class DocumentoBase(BaseModel):
    tipo_documento: TipoDocumentoEnum
    direccion: DireccionEnum
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    remitente: Optional[str] = None
    destinatario: Optional[str] = None
    titulo: Optional[str] = None
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None
    documento_padre_id: Optional[int] = None


class DocumentoCreate(DocumentoBase):
    """Schema para crear un nuevo documento"""
    pass


class DocumentoUpdate(BaseModel):
    """Schema para actualizar un documento existente"""
    tipo_documento: Optional[TipoDocumentoEnum] = None
    direccion: Optional[DireccionEnum] = None
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    remitente: Optional[str] = None
    destinatario: Optional[str] = None
    titulo: Optional[str] = None
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None
    documento_padre_id: Optional[int] = None


class DocumentoResponse(DocumentoBase):
    """Schema para respuesta de documento"""
    id: int
    archivo_local: Optional[str] = None
    archivo_docx: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    adjuntos: List[AdjuntoResponse] = []

    class Config:
        from_attributes = True


class DocumentoListResponse(BaseModel):
    """Schema para lista de documentos con paginación"""
    documentos: List[DocumentoResponse]
    total: int
    pagina: int
    por_pagina: int


# === Schemas para IA ===

class AnalisisIARequest(BaseModel):
    """Request para análisis con IA"""
    texto: Optional[str] = None  # Texto extraído del documento


class AnalisisIAResponse(BaseModel):
    """Respuesta del análisis con IA"""
    numero_oficio: str = Field(default="", description="Número de oficio extraído del documento")
    fecha: str = Field(default="", description="Fecha del documento en formato YYYY-MM-DD")
    remitente: str = Field(default="", description="Remitente del documento")
    destinatario: str = Field(default="", description="Destinatario del documento")
    asunto: str = Field(default="", description="Asunto claro del documento")
    resumen: str = Field(default="", description="Resumen indicando qué solicita y para cuándo")
    mensaje_whatsapp: str = Field(default="", description="Mensaje formateado para compartir por WhatsApp")
    oficio_referencia: str = Field(default="", description="Número del oficio al que responde esta carta")
    exito: bool = True
    mensaje: Optional[str] = None


# === Schema para filtros de búsqueda ===

class DocumentoFiltros(BaseModel):
    tipo_documento: Optional[TipoDocumentoEnum] = None
    direccion: Optional[DireccionEnum] = None
    busqueda: Optional[str] = None
    pagina: int = 1
    por_pagina: int = 20


# === Schemas para Autenticación ===

class LoginRequest(BaseModel):
    """Request para login"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Respuesta del login"""
    token: str
    usuario: str
    nombre: str
    mensaje: str = "Login exitoso"


class UsuarioResponse(BaseModel):
    """Respuesta de usuario (sin password)"""
    id: int
    username: str
    nombre: str
    activo: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Adjuntos de Contrato ===

class AdjuntoContratoBase(BaseModel):
    nombre: str
    enlace_drive: Optional[str] = None
    archivo_local: Optional[str] = None


class AdjuntoContratoCreate(AdjuntoContratoBase):
    pass


class AdjuntoContratoResponse(AdjuntoContratoBase):
    id: int
    contrato_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Contratos ===

# === Schemas para Comisarías de Contrato ===

class ComisariaContratoBase(BaseModel):
    nombre_cpnp: str
    monto: float


class ComisariaContratoCreate(ComisariaContratoBase):
    """Schema para crear una comisaría de contrato"""
    pass


class ComisariaContratoResponse(ComisariaContratoBase):
    """Schema para respuesta de comisaría"""
    id: int
    contrato_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Contratos ===

class ContratoBase(BaseModel):
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    tipo_contrato: Optional[str] = None  # equipamiento, mantenimiento
    contratante: Optional[str] = None
    tipo_contratado: Optional[str] = 'empresa'  # empresa | consorcio
    ruc_contratado: Optional[str] = None
    contratado: Optional[str] = None
    item_contratado: Optional[str] = None
    plazo_dias: Optional[int] = None  # Número de días del contrato
    dias_adicionales: Optional[int] = 0  # Días de adendas (por defecto 0)
    cantidad: Optional[int] = None
    precio_unitario: Optional[float] = None  # Solo para equipamiento
    monto_total: Optional[float] = None  # Calculado automáticamente
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None
    estado_ejecucion: Optional[str] = 'PENDIENTE'  # PENDIENTE, EN PROCESO, EN VALIDACIÓN, CONFORME
    # Datos del representante
    nombre_representante: Optional[str] = None
    cargo_representante: Optional[str] = None
    email_representante: Optional[str] = None
    whatsapp_representante: Optional[str] = None


class ContratoCreate(ContratoBase):
    """Schema para crear un nuevo contrato"""
    comisarias: Optional[List[ComisariaContratoCreate]] = None  # Solo para mantenimiento


class ContratoUpdate(BaseModel):
    """Schema para actualizar un contrato existente"""
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    tipo_contrato: Optional[str] = None
    contratante: Optional[str] = None
    tipo_contratado: Optional[str] = None
    ruc_contratado: Optional[str] = None
    contratado: Optional[str] = None
    item_contratado: Optional[str] = None
    plazo_dias: Optional[int] = None
    dias_adicionales: Optional[int] = None
    cantidad: Optional[int] = None
    precio_unitario: Optional[float] = None
    monto_total: Optional[float] = None
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None
    estado_ejecucion: Optional[str] = None
    comisarias: Optional[List[ComisariaContratoCreate]] = None
    nombre_representante: Optional[str] = None
    cargo_representante: Optional[str] = None
    email_representante: Optional[str] = None
    whatsapp_representante: Optional[str] = None


class ContratoResponse(ContratoBase):
    """Schema para respuesta de contrato"""
    id: int
    archivo_local: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    adjuntos: List[AdjuntoContratoResponse] = []
    comisarias: List[ComisariaContratoResponse] = []

    class Config:
        from_attributes = True


class ContratoListResponse(BaseModel):
    """Schema para lista de contratos con paginación"""
    contratos: List[ContratoResponse]
    total: int
    pagina: int
    por_pagina: int


# ─── Expediente por Contrato ────────────────────────────────────────────────

class ExpedienteContratoCreate(BaseModel):
    tipo_doc: str   # Carta Recibida | Carta Enviada | Informe Técnico | Acta | Oficio | Otro
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    asunto: Optional[str] = None
    enlace_drive: Optional[str] = None
    notas: Optional[str] = None
    archivo_temporal: Optional[str] = None


class ExpedienteContratoUpdate(BaseModel):
    tipo_doc: Optional[str] = None
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    asunto: Optional[str] = None
    enlace_drive: Optional[str] = None
    notas: Optional[str] = None
    archivo_temporal: Optional[str] = None


class ExpedienteContratoResponse(BaseModel):
    id: int
    contrato_id: int
    tipo_doc: str
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    asunto: Optional[str] = None
    archivo_local: Optional[str] = None
    enlace_drive: Optional[str] = None
    notas: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Plantillas de Carta ===

class PlantillaCartaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None


class PlantillaCartaResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    archivo_local: Optional[str] = None
    activa: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Generador de Cartas IA ===

class GenerarCartaRequest(BaseModel):
    contrato_id: int
    asunto: str
    referencias: Optional[str] = None       # Texto libre con referencias (ej. "a) Convenio N°005...")
    instrucciones: Optional[str] = None     # Instrucciones adicionales para la IA
    plantilla_id: Optional[int] = None      # Plantilla de referencia (opcional)


class GenerarCartaResponse(BaseModel):
    numero_carta: str           # Número sugerido para la carta
    fecha_texto: str            # Ej: "Lima, 13 de abril de 2026"
    destinatario_nombre: str
    destinatario_cargo: str
    destinatario_institucion: str
    asunto: str
    referencias: str
    cuerpo: str                 # Cuerpo completo de la carta
    cierre: str                 # Párrafo de cierre
    exito: bool = True
    mensaje: Optional[str] = None


class ExportarCartaRequest(BaseModel):
    numero_carta: str
    fecha_texto: str
    destinatario_nombre: str
    destinatario_cargo: str
    destinatario_institucion: str
    asunto: str
    referencias: Optional[str] = None
    cuerpo: str
    cierre: str
    plantilla_id: Optional[int] = None
    contrato_id: Optional[int] = None


# === Schemas para Seguimiento de Liquidación ===

class SeguimientoCeldaDetalleResponse(BaseModel):
    id: int
    campo: str
    observacion: Optional[str] = None
    enlace: Optional[str] = None
    archivo_local: Optional[str] = None
    archivo_nombre: Optional[str] = None
    usuario: str
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


class SeguimientoComisariaResponse(BaseModel):
    id: int
    numero: int
    comisaria: str
    avance_programado: Optional[float] = None
    avance_fisico: Optional[float] = None
    fecha_fin_contractual: Optional[datetime] = None
    acta_fecha_firma: Optional[datetime] = None
    acta_revisada: Optional[str] = None
    acta_remitida_ugpe: Optional[str] = None
    mod_presentado_ne: Optional[str] = None
    mod_revisado_aprobado: Optional[str] = None
    mod_remitido_ugpe: Optional[str] = None
    amp_presentado_ne: Optional[str] = None
    amp_revisado_aprobado: Optional[str] = None
    amp_adenda_firmada: Optional[str] = None
    amp_remitido_ugpe: Optional[str] = None
    dossier_presentado_ne: Optional[str] = None
    dossier_revisado_aprobado: Optional[str] = None
    dossier_remitido_ugpe: Optional[str] = None
    dossier_remitido_pago: Optional[str] = None
    dossier_monto_pagado: Optional[float] = None
    dossier_monto_merge: Optional[bool] = False
    liq_presentado_ne: Optional[str] = None
    liq_revisado_aprobado: Optional[str] = None
    liq_remitido_pago: Optional[str] = None
    observaciones: Optional[str] = None
    updated_at: Optional[datetime] = None
    detalles: List[SeguimientoCeldaDetalleResponse] = []

    class Config:
        from_attributes = True


class ActualizarCeldaRequest(BaseModel):
    campo: str
    valor: Optional[str] = None        # SI / NO / NA / - / None
    observacion: Optional[str] = None
    enlace: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────────
# KAIZEN — Registro de Mejora
# ─────────────────────────────────────────────────────────────────────────────────

class RegistroMejoraCreate(BaseModel):
    proyecto_comisaria: Optional[str] = None
    problema: Optional[str] = None
    impacto_descripcion: Optional[str] = None
    impacto_tipos: Optional[str] = None
    porques: Optional[str] = None
    solucion: Optional[str] = None
    solucion_responsable: Optional[str] = None
    solucion_momento: Optional[str] = None
    aprendizaje: Optional[str] = None
    clasificacion_tipo: Optional[str] = None
    clasificacion_impacto: Optional[str] = None

class RegistroMejoraUpdate(RegistroMejoraCreate):
    estado: Optional[str] = None

class RegistroMejoraResponse(RegistroMejoraCreate):
    id: int
    usuario: str
    estado: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class AsistirMejoraRequest(BaseModel):
    bloque: str
    accion: str
    texto: str
    contexto: Optional[str] = None
    historial: Optional[List[Dict[str, str]]] = None  # conversación previa

class AsistirMejoraResponse(BaseModel):
    respuesta: str
    tipo: str          # pregunta|sugerencia|reformulacion
