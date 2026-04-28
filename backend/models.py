"""
Modelos SQLAlchemy para el sistema de gestión de correspondencia
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from database import Base


class TipoDocumento(str, enum.Enum):
    """Tipos de documento permitidos"""
    OFICIO = "oficio"
    CARTA = "carta"


class Direccion(str, enum.Enum):
    """Dirección del documento"""
    RECIBIDO = "recibido"
    ENVIADO = "enviado"


class Documento(Base):
    """
    Modelo principal de documentos.
    Almacena oficios y cartas, tanto recibidos como enviados.
    """
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    tipo_documento = Column(String(20), nullable=False)  # oficio, carta
    direccion = Column(String(20), nullable=False)  # recibido, enviado
    numero = Column(String(50), nullable=True)  # Número del documento
    fecha = Column(DateTime, nullable=True)  # Fecha del documento
    remitente = Column(String(255), nullable=True)
    destinatario = Column(String(255), nullable=True)
    titulo = Column(String(500), nullable=True)  # Generado por IA o manual
    asunto = Column(String(500), nullable=True)  # Generado por IA o manual
    resumen = Column(Text, nullable=True)  # Generado por IA o manual
    anio_oficio = Column(Integer, nullable=True)  # Año extraído del número (para ordenamiento)
    correlativo_oficio = Column(Integer, nullable=True)  # Número correlativo (para ordenamiento)
    enlace_drive = Column(String(500), nullable=True)  # Link a Google Drive
    archivo_local = Column(String(500), nullable=True)  # Ruta archivo subido (PDF)
    archivo_docx = Column(String(500), nullable=True)   # Ruta archivo Word (solo cartas IA)

    # Relación padre-hijo para respuestas
    documento_padre_id = Column(Integer, ForeignKey("documentos.id"), nullable=True)

    # Estado del documento (solo relevante para cartas generadas con IA)
    # 'enviado' es el default para todos los documentos existentes y los nuevos no-IA
    estado = Column(String(20), default='enviado')

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relaciones
    adjuntos = relationship("Adjunto", back_populates="documento", cascade="all, delete-orphan")
    respuestas = relationship("Documento", backref="documento_padre", remote_side=[id])


class Adjunto(Base):
    """
    Modelo para archivos adjuntos adicionales al documento principal.
    """
    __tablename__ = "adjuntos"

    id = Column(Integer, primary_key=True, index=True)
    documento_id = Column(Integer, ForeignKey("documentos.id"), nullable=False)
    nombre = Column(String(255), nullable=False)
    enlace_drive = Column(String(500), nullable=True)
    archivo_local = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relación
    documento = relationship("Documento", back_populates="adjuntos")


class Usuario(Base):
    """
    Modelo para usuarios administradores del sistema.
    """
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=False)  # Nombre completo para mostrar
    activo = Column(Integer, default=1)  # 1 = activo, 0 = inactivo
    created_at = Column(DateTime, server_default=func.now())


class Contrato(Base):
    """
    Modelo para contratos institucionales.
    Tabla independiente de documentos.
    """
    __tablename__ = "contratos"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(50), nullable=True)
    fecha = Column(DateTime, nullable=True)
    tipo_contrato = Column(String(20), nullable=True)  # equipamiento, mantenimiento
    contratante = Column(String(255), nullable=True)
    tipo_contratado = Column(String(20), nullable=True, default='empresa')  # empresa | consorcio
    ruc_contratado = Column(String(11), nullable=True)  # RUC del contratado (solo empresa)
    contratado = Column(String(255), nullable=True)  # Razón social o nombre del consorcio
    item_contratado = Column(String(500), nullable=True)
    # Campos de plazo
    plazo_dias = Column(Integer, nullable=True)  # Número de días del contrato
    dias_adicionales = Column(Integer, default=0)  # Días de adendas (por defecto 0)
    # Campos para EQUIPAMIENTO
    cantidad = Column(Integer, nullable=True)
    precio_unitario = Column(Float, nullable=True)  # Solo para equipamiento
    monto_total = Column(Float, nullable=True)  # Calculado automáticamente
    asunto = Column(String(500), nullable=True)
    resumen = Column(Text, nullable=True)
    archivo_local = Column(String(500), nullable=True)
    enlace_drive = Column(String(500), nullable=True)
    estado_ejecucion = Column(String(30), default='PENDIENTE')  # PENDIENTE, EN PROCESO, EN VALIDACIÓN, CONFORME

    # Datos del representante (para cartas)
    nombre_representante = Column(String(255), nullable=True)
    cargo_representante = Column(String(255), nullable=True)
    email_representante = Column(String(255), nullable=True)
    whatsapp_representante = Column(String(20), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    adjuntos = relationship("AdjuntoContrato", back_populates="contrato", cascade="all, delete-orphan")
    comisarias = relationship("ComisariaContrato", back_populates="contrato", cascade="all, delete-orphan")
    expediente = relationship("ExpedienteContrato", back_populates="contrato", cascade="all, delete-orphan")


class ComisariaContrato(Base):
    """
    Modelo para comisarías en contratos de mantenimiento.
    Cada contrato de mantenimiento puede tener una o más comisarías.
    """
    __tablename__ = "comisarias_contrato"

    id = Column(Integer, primary_key=True, index=True)
    contrato_id = Column(Integer, ForeignKey("contratos.id"), nullable=False)
    nombre_cpnp = Column(String(255), nullable=False)  # Nombre de la comisaría
    monto = Column(Float, nullable=False)  # Monto para esta comisaría
    created_at = Column(DateTime, default=datetime.utcnow)

    contrato = relationship("Contrato", back_populates="comisarias")


class ExpedienteContrato(Base):
    """
    Expediente histórico de un contrato.
    Registra toda la documentación generada durante la vida del contrato:
    cartas, informes técnicos, actas, oficios, etc.
    """
    __tablename__ = "expediente_contrato"

    id = Column(Integer, primary_key=True, index=True)
    contrato_id = Column(Integer, ForeignKey("contratos.id"), nullable=False)
    tipo_doc = Column(String(30), nullable=False)   # Carta Recibida | Carta Enviada | Informe Técnico | Acta | Oficio | Otro
    numero = Column(String(150), nullable=True)
    fecha = Column(DateTime, nullable=True)
    asunto = Column(String(500), nullable=True)
    archivo_local = Column(String(500), nullable=True)
    enlace_drive = Column(String(500), nullable=True)
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    contrato = relationship("Contrato", back_populates="expediente")


class PlantillaCarta(Base):
    """
    Plantilla de carta institucional.
    El archivo .docx sirve de referencia estructural para la IA al generar cartas.
    """
    __tablename__ = "plantillas_carta"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    archivo_local = Column(String(500), nullable=True)  # Ruta al .docx de referencia
    activa = Column(Integer, default=1)  # 1 = activa (plantilla principal)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class ConfiguracionSistema(Base):
    """
    Configuración global del sistema (clave-valor).
    Se usa para guardar membrete, logo, etc.
    """
    __tablename__ = "configuracion_sistema"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(100), unique=True, nullable=False)
    valor = Column(Text, nullable=True)
    updated_at = Column(DateTime, onupdate=func.now())


class CartaGenerada(Base):
    """
    Registro de cartas generadas por IA.
    Permite llevar el correlativo propio de cartas independiente de otros documentos.
    """
    __tablename__ = "cartas_generadas"

    id = Column(Integer, primary_key=True, index=True)
    numero_correlativo = Column(Integer, nullable=False)  # 1, 2, 3 ...
    anio = Column(Integer, nullable=False)
    numero_completo = Column(String(200), nullable=False)  # "Carta N° 000001-2026-..."
    contrato_id = Column(Integer, ForeignKey("contratos.id"), nullable=True)
    asunto = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class AdjuntoContrato(Base):
    """
    Modelo para archivos adjuntos de contratos.
    """
    __tablename__ = "adjuntos_contrato"

    id = Column(Integer, primary_key=True, index=True)
    contrato_id = Column(Integer, ForeignKey("contratos.id"), nullable=False)
    nombre = Column(String(255), nullable=False)
    enlace_drive = Column(String(500), nullable=True)
    archivo_local = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    contrato = relationship("Contrato", back_populates="adjuntos")


class SeguimientoComisaria(Base):
    """
    Seguimiento del proceso de liquidación por comisaría PNP.
    Una fila por comisaría con todos los campos SI/NO del Excel.
    """
    __tablename__ = "seguimiento_comisaria"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer, nullable=False)
    comisaria = Column(String(255), nullable=False)
    avance_programado = Column(Float, nullable=True)
    avance_fisico = Column(Float, nullable=True)
    fecha_fin_contractual = Column(DateTime, nullable=True)

    # 1. Acta de Conformidad
    acta_fecha_firma = Column(DateTime, nullable=True)
    acta_revisada = Column(String(5), nullable=True)          # SI/NO/NA/-
    acta_remitida_ugpe = Column(String(5), nullable=True)

    # 2. Informe de Modificación de Partidas
    mod_presentado_ne = Column(String(5), nullable=True)
    mod_revisado_aprobado = Column(String(5), nullable=True)
    mod_remitido_ugpe = Column(String(5), nullable=True)

    # 3. Informe de Ampliación de Plazo
    amp_presentado_ne = Column(String(5), nullable=True)
    amp_revisado_aprobado = Column(String(5), nullable=True)
    amp_adenda_firmada = Column(String(5), nullable=True)
    amp_remitido_ugpe = Column(String(5), nullable=True)
    amp_merge = Column(Boolean, default=False, nullable=False, server_default='0')

    # 4. Informe de Culminación y Entrega de Obra (DOSSIER)
    dossier_presentado_ne = Column(String(5), nullable=True)
    dossier_revisado_aprobado = Column(String(5), nullable=True)
    dossier_remitido_ugpe = Column(String(5), nullable=True)
    dossier_remitido_pago = Column(String(5), nullable=True)
    dossier_monto_pagado = Column(Float, nullable=True)
    dossier_monto_merge = Column(Boolean, default=False, nullable=False, server_default='0')

    # 5. Informe de Liquidación (Final)
    liq_presentado_ne = Column(String(5), nullable=True)
    liq_revisado_aprobado = Column(String(5), nullable=True)
    liq_remitido_pago = Column(String(5), nullable=True)

    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    detalles = relationship("SeguimientoCeldaDetalle", back_populates="comisaria", cascade="all, delete-orphan")


class SeguimientoCeldaDetalle(Base):
    """
    Registro de detalle cuando un campo pasa a SI.
    Guarda observaciones, enlace y/o archivo adjunto, y quién/cuándo lo actualizó.
    """
    __tablename__ = "seguimiento_celda_detalle"

    id = Column(Integer, primary_key=True, index=True)
    comisaria_id = Column(Integer, ForeignKey("seguimiento_comisaria.id"), nullable=False)
    campo = Column(String(100), nullable=False)       # Nombre del campo actualizado
    observacion = Column(Text, nullable=True)
    enlace = Column(String(500), nullable=True)
    archivo_local = Column(String(500), nullable=True)
    archivo_nombre = Column(String(255), nullable=True)
    usuario = Column(String(100), nullable=False)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, nullable=False)

    comisaria = relationship("SeguimientoComisaria", back_populates="detalles")


class RegistroMejora(Base):
    """Registro de Mejora Kaizen — captura estructurada de problemas y aprendizajes"""
    __tablename__ = "registros_mejora"

    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String(100), nullable=False)
    proyecto_comisaria = Column(String(255), nullable=True)

    # Bloque 1: Problema
    problema = Column(Text, nullable=True)

    # Bloque 2: Impacto
    impacto_descripcion = Column(Text, nullable=True)
    impacto_tipos = Column(Text, nullable=True)       # JSON: ["Retraso","Sobrecosto",...]

    # Bloque 3: Causa raíz (5 Porqués)
    porques = Column(Text, nullable=True)             # JSON: ["porqué1","porqué2",...]

    # Bloque 4: Solución
    solucion = Column(Text, nullable=True)
    solucion_responsable = Column(String(255), nullable=True)
    solucion_momento = Column(String(20), nullable=True)  # Antes|Durante|Después

    # Bloque 5: Aprendizaje
    aprendizaje = Column(Text, nullable=True)

    # Bloque 6: Clasificación
    clasificacion_tipo = Column(String(50), nullable=True)
    clasificacion_impacto = Column(String(20), nullable=True)

    estado = Column(String(20), default='draft')      # draft | enviado
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
