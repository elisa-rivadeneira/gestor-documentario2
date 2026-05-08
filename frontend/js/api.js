/**
 * Cliente API para el Sistema de Gestión de Correspondencia
 * Maneja todas las comunicaciones con el backend FastAPI
 */

// Detectar automáticamente la URL del API (funciona en local y producción)
const API_BASE = window.location.origin + '/api';

// ============================================
// AUTENTICACIÓN
// ============================================

/**
 * Obtiene el token almacenado
 */
function getToken() {
    return localStorage.getItem('auth_token');
}

/**
 * Guarda el token
 */
function setToken(token) {
    localStorage.setItem('auth_token', token);
}

/**
 * Elimina el token (logout)
 */
function removeToken() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_usuario');
    localStorage.removeItem('auth_nombre');
    localStorage.removeItem('auth_role');
}

/**
 * Verifica si el usuario está autenticado
 */
function estaAutenticado() {
    return !!getToken();
}

/**
 * Obtiene info del usuario logueado
 */
function getUsuarioActual() {
    return {
        usuario: localStorage.getItem('auth_usuario'),
        nombre: localStorage.getItem('auth_nombre')
    };
}

/**
 * Clase para manejar errores de la API
 */
class APIError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'APIError';
    }
}

/**
 * Función helper para realizar peticiones HTTP
 */
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const config = { ...defaultOptions, ...options };

    // Agregar token de autenticación si existe
    const token = getToken();
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    // No incluir Content-Type para FormData
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    try {
        const response = await fetch(url, config);

        // Para respuestas 204 No Content
        if (response.status === 204) {
            return null;
        }

        const data = await response.json();

        if (!response.ok) {
            // Si es 401, limpiar token (sesión expirada)
            if (response.status === 401) {
                removeToken();
            }
            throw new APIError(data.detail || 'Error en la petición', response.status);
        }

        return data;
    } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(`Error de conexión: ${error.message}`, 0);
    }
}

/**
 * Login de usuario
 */
async function apiLogin(username, password) {
    const response = await fetchAPI('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });

    // Guardar token e info del usuario
    if (response.token) {
        setToken(response.token);
        localStorage.setItem('auth_usuario', response.usuario);
        localStorage.setItem('auth_nombre', response.nombre);
        localStorage.setItem('auth_role', response.role || 'admin');
    }

    return response;
}

function esSuperAdmin() {
    return localStorage.getItem('auth_role') === 'superadmin';
}

/**
 * Logout de usuario
 */
function apiLogout() {
    removeToken();
}

/**
 * Verifica si el token actual es válido
 */
async function apiVerificarToken() {
    try {
        return await fetchAPI('/verificar-token');
    } catch (error) {
        return null;
    }
}

// ============================================
// DOCUMENTOS
// ============================================

/**
 * Lista documentos con filtros opcionales
 */
async function apiListarDocumentos(filtros = {}) {
    const params = new URLSearchParams();

    if (filtros.tipo_documento) params.append('tipo_documento', filtros.tipo_documento);
    if (filtros.direccion) params.append('direccion', filtros.direccion);
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
    if (filtros.ordenar_por) params.append('ordenar_por', filtros.ordenar_por);
    if (filtros.pagina) params.append('pagina', filtros.pagina);
    if (filtros.por_pagina) params.append('por_pagina', filtros.por_pagina);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchAPI(`/documentos${query}`);
}

/**
 * Obtiene un documento por ID
 */
async function apiObtenerDocumento(id) {
    return await fetchAPI(`/documentos/${id}`);
}

/**
 * Crea un nuevo documento
 */
async function apiCrearDocumento(documento) {
    return await fetchAPI('/documentos', {
        method: 'POST',
        body: JSON.stringify(documento),
    });
}

/**
 * Actualiza un documento existente
 */
async function apiActualizarDocumento(id, documento) {
    return await fetchAPI(`/documentos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(documento),
    });
}

/**
 * Elimina un documento
 */
async function apiEliminarDocumento(id) {
    return await fetchAPI(`/documentos/${id}`, {
        method: 'DELETE',
    });
}

/**
 * Obtiene respuestas de un documento
 */
async function apiObtenerRespuestas(documentoId) {
    return await fetchAPI(`/documentos/${documentoId}/respuestas`);
}

// ============================================
// ARCHIVOS
// ============================================

/**
 * Sube un archivo a un documento existente
 */
async function apiSubirArchivo(documentoId, archivo) {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return await fetchAPI(`/documentos/${documentoId}/archivo`, {
        method: 'POST',
        body: formData,
    });
}

/**
 * Sube un archivo temporal (antes de crear documento)
 */
async function apiSubirArchivoTemporal(archivo) {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return await fetchAPI('/subir-temporal', {
        method: 'POST',
        body: formData,
    });
}

/**
 * Asocia un archivo temporal ya subido a un documento
 */
async function apiAsociarArchivoTemporal(documentoId, nombreTemporal) {
    return await fetchAPI(`/documentos/${documentoId}/asociar-archivo?nombre_temporal=${encodeURIComponent(nombreTemporal)}`, {
        method: 'POST',
    });
}

// ============================================
// ANÁLISIS IA
// ============================================

/**
 * Analiza texto con IA
 */
async function apiAnalizarTexto(texto) {
    return await fetchAPI('/analizar-ia', {
        method: 'POST',
        body: JSON.stringify({ texto }),
    });
}

/**
 * Analiza un archivo PDF con IA
 */
async function apiAnalizarArchivo(nombreArchivo) {
    return await fetchAPI(`/analizar-archivo/${encodeURIComponent(nombreArchivo)}`, {
        method: 'POST',
    });
}

// ============================================
// ADJUNTOS
// ============================================

/**
 * Agrega un adjunto a un documento
 */
async function apiAgregarAdjunto(documentoId, archivo, enlaceDrive, nombre) {
    const formData = new FormData();
    if (archivo) formData.append('archivo', archivo);
    if (enlaceDrive) formData.append('enlace_drive', enlaceDrive);
    if (nombre) formData.append('nombre', nombre);

    const params = new URLSearchParams();
    if (enlaceDrive) params.append('enlace_drive', enlaceDrive);
    if (nombre) params.append('nombre', nombre);

    const query = params.toString() ? `?${params.toString()}` : '';

    return await fetchAPI(`/documentos/${documentoId}/adjuntos${query}`, {
        method: 'POST',
        body: archivo ? formData : undefined,
    });
}

/**
 * Elimina un adjunto
 */
async function apiEliminarAdjunto(adjuntoId) {
    return await fetchAPI(`/adjuntos/${adjuntoId}`, {
        method: 'DELETE',
    });
}

// ============================================
// CONTRATOS
// ============================================

/**
 * Lista contratos con filtros opcionales
 */
async function apiListarContratos(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
    if (filtros.tipo_contrato) params.append('tipo_contrato', filtros.tipo_contrato);
    if (filtros.pagina) params.append('pagina', filtros.pagina);
    if (filtros.por_pagina) params.append('por_pagina', filtros.por_pagina);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchAPI(`/contratos${query}`);
}

/**
 * Obtiene un contrato por ID
 */
async function apiObtenerContrato(id) {
    return await fetchAPI(`/contratos/${id}`);
}

/**
 * Crea un nuevo contrato
 */
async function apiCrearContrato(contrato) {
    return await fetchAPI('/contratos', {
        method: 'POST',
        body: JSON.stringify(contrato),
    });
}

/**
 * Actualiza un contrato existente
 */
async function apiActualizarContrato(id, contrato) {
    return await fetchAPI(`/contratos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(contrato),
    });
}

/**
 * Elimina un contrato
 */
async function apiEliminarContrato(id) {
    return await fetchAPI(`/contratos/${id}`, {
        method: 'DELETE',
    });
}

/**
 * Asocia un archivo temporal a un contrato
 */
async function apiAsociarArchivoContrato(contratoId, nombreTemporal) {
    return await fetchAPI(`/contratos/${contratoId}/asociar-archivo?nombre_temporal=${encodeURIComponent(nombreTemporal)}`, {
        method: 'POST',
    });
}

/**
 * Agrega un adjunto a un contrato
 */
async function apiAgregarAdjuntoContrato(contratoId, archivo, enlaceDrive, nombre) {
    const formData = new FormData();
    if (archivo) formData.append('archivo', archivo);

    const params = new URLSearchParams();
    if (enlaceDrive) params.append('enlace_drive', enlaceDrive);
    if (nombre) params.append('nombre', nombre);

    const query = params.toString() ? `?${params.toString()}` : '';

    return await fetchAPI(`/contratos/${contratoId}/adjuntos${query}`, {
        method: 'POST',
        body: archivo ? formData : undefined,
    });
}

/**
 * Elimina un adjunto de contrato
 */
async function apiEliminarAdjuntoContrato(adjuntoId) {
    return await fetchAPI(`/adjuntos-contrato/${adjuntoId}`, {
        method: 'DELETE',
    });
}

/**
 * Consulta la razón social de un RUC en SUNAT
 */
async function apiConsultarRUC(ruc) {
    return await fetchAPI(`/consultar-ruc/${ruc}`);
}

// ============================================
// EXPEDIENTE POR CONTRATO
// ============================================

async function apiListarExpediente(contratoId) {
    return await fetchAPI(`/contratos/${contratoId}/expediente`);
}

async function apiCrearExpediente(contratoId, data) {
    return await fetchAPI(`/contratos/${contratoId}/expediente`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

async function apiActualizarExpediente(itemId, data) {
    return await fetchAPI(`/expediente/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

async function apiEliminarExpediente(itemId) {
    return await fetchAPI(`/expediente/${itemId}`, {
        method: 'DELETE',
    });
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Verifica el estado del servidor
 */
async function apiHealthCheck() {
    return await fetchAPI('/health');
}
