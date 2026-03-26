/**
 * Aplicación principal del Sistema de Gestión de Correspondencia
 * Maneja la UI y la lógica de la aplicación
 */

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================

let state = {
    documentoActual: null,
    archivoTemporal: null,
    paginaActual: 1,
    editando: false,
    categoriaActual: 'oficios', // Por defecto: oficios
    oficiosDisponibles: [], // Lista de oficios para el dropdown de referencia
    adjuntosTemporales: [], // Lista de adjuntos a subir
    // Contratos
    contratoActual: null,
    archivoTemporalContrato: null,
    adjuntosTemporalesContrato: [],
    contratosOriginales: [], // Para filtros en frontend
    contratosFiltrados: [],  // Resultado de aplicar filtros
    contratosSortColumn: null,
    contratosSortDir: 'asc'
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticación y actualizar UI
    actualizarUIAutenticacion();
    // Si está autenticado, mostrar oficios; si no, mostrar contratos (público)
    if (estaAutenticado()) {
        filtrarPorCategoria('oficios');
    } else {
        filtrarPorCategoria('contratos');
    }
});

// ============================================
// AUTENTICACIÓN
// ============================================

/**
 * Actualiza la UI según el estado de autenticación
 */
function actualizarUIAutenticacion() {
    const autenticado = estaAutenticado();
    const btnLogin = document.getElementById('btn-login');
    const usuarioInfo = document.getElementById('usuario-info');
    const usuarioNombre = document.getElementById('usuario-nombre');

    // Elementos que solo se muestran para admins
    const elementosAdmin = document.querySelectorAll('.admin-only');

    // Elementos que solo se muestran para usuarios autenticados (correspondencia)
    const elementosCorrespondencia = document.querySelectorAll('.auth-only');

    if (autenticado) {
        // Mostrar info de usuario y ocultar botón login
        btnLogin.classList.add('hidden');
        usuarioInfo.classList.remove('hidden');
        const usuario = getUsuarioActual();
        usuarioNombre.textContent = usuario.nombre || usuario.usuario;

        // Mostrar elementos de admin
        elementosAdmin.forEach(el => el.classList.remove('hidden'));

        // Mostrar categorías de correspondencia
        elementosCorrespondencia.forEach(el => el.classList.remove('hidden'));
    } else {
        // Mostrar botón login y ocultar info de usuario
        btnLogin.classList.remove('hidden');
        usuarioInfo.classList.add('hidden');

        // Ocultar elementos de admin
        elementosAdmin.forEach(el => el.classList.add('hidden'));

        // Ocultar categorías de correspondencia
        elementosCorrespondencia.forEach(el => el.classList.add('hidden'));

        // Si está en una categoría de correspondencia, redirigir a contratos
        if (['oficios', 'cartas-recibidas', 'cartas-nemaec'].includes(state.categoriaActual)) {
            filtrarPorCategoria('contratos');
        }
    }
}

/**
 * Muestra la vista de login
 */
function mostrarLogin() {
    mostrarVista('vista-login');
    document.getElementById('login-usuario').focus();
}

/**
 * Procesa el formulario de login
 */
async function hacerLogin(event) {
    event.preventDefault();

    const usuario = document.getElementById('login-usuario').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btnSubmit = document.getElementById('btn-login-submit');

    // Limpiar error previo
    errorEl.classList.add('hidden');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Ingresando...';

    try {
        await apiLogin(usuario, password);
        // Login exitoso
        actualizarUIAutenticacion();
        mostrarBandeja();
        mostrarToast(`Bienvenido, ${getUsuarioActual().nombre}`);
    } catch (error) {
        // Mostrar error
        errorEl.textContent = error.message || 'Usuario o contraseña incorrectos';
        errorEl.classList.remove('hidden');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Iniciar Sesión';
    }
}

/**
 * Cierra la sesión del usuario
 */
function hacerLogout() {
    apiLogout();
    actualizarUIAutenticacion();
    mostrarBandeja();
    mostrarToast('Sesión cerrada');
}

// ============================================
// NAVEGACIÓN POR CATEGORÍAS
// ============================================

function filtrarPorCategoria(categoria) {
    state.categoriaActual = categoria;
    state.paginaActual = 1;

    // Restaurar headers de tabla si venimos de contratos (ANTES de buscar elementos)
    restaurarHeadersTablaDocumentos();

    // Configurar filtros según la categoría
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroDireccion = document.getElementById('filtro-direccion');
    const filtroReferencia = document.getElementById('filtro-referencia');
    const colReferencia = document.getElementById('col-referencia');
    const colDocumento = document.getElementById('col-documento');
    const filtrosTipoContrato = document.getElementById('filtros-tipo-contrato');

    // Limpiar filtro de referencia al cambiar de categoría
    filtroReferencia.value = '';

    // Ocultar filtros de tipo de contrato por defecto
    filtrosTipoContrato.classList.add('hidden');

    // Restaurar título por defecto (se cambia solo para contratos)
    document.getElementById('titulo-bandeja').textContent = 'Bandeja de Correspondencia';

    switch (categoria) {
        case 'cartas-nemaec':
            // Cartas enviadas (NEMAEC)
            filtroTipo.value = 'carta';
            filtroDireccion.value = 'enviado';
            // Mostrar columna y filtro de referencia
            filtroReferencia.classList.remove('hidden');
            colReferencia.classList.remove('hidden');
            // Cambiar título de columna a CARTA
            colDocumento.textContent = 'CARTA';
            break;
        case 'oficios':
            // Todos los oficios
            filtroTipo.value = 'oficio';
            filtroDireccion.value = '';
            // Ocultar columna y filtro de referencia
            filtroReferencia.classList.add('hidden');
            colReferencia.classList.add('hidden');
            // Cambiar título de columna a OFICIO
            colDocumento.textContent = 'OFICIO';
            break;
        case 'cartas-recibidas':
            // Cartas recibidas
            filtroTipo.value = 'carta';
            filtroDireccion.value = 'recibido';
            // Ocultar columna y filtro de referencia
            filtroReferencia.classList.add('hidden');
            colReferencia.classList.add('hidden');
            // Cambiar título de columna a CARTA
            colDocumento.textContent = 'CARTA';
            break;
        case 'contratos':
            // Contratos - usa su propio flujo
            filtroReferencia.classList.add('hidden');
            colReferencia.classList.add('hidden');
            colDocumento.textContent = 'CONTRATO';
            // Cambiar título de la bandeja
            document.getElementById('titulo-bandeja').textContent = 'Contratos';
            // Mostrar filtros de tipo de contrato
            document.getElementById('filtros-tipo-contrato').classList.remove('hidden');
            actualizarBotonesMenu(categoria);
            cargarContratos();
            return;
    }

    // Actualizar estilos de botones activos
    actualizarBotonesMenu(categoria);

    // Cargar documentos con los nuevos filtros
    cargarDocumentos();
}

function actualizarBotonesMenu(categoriaActiva) {
    const botones = ['cartas-nemaec', 'oficios', 'cartas-recibidas', 'contratos'];

    botones.forEach(cat => {
        const btn = document.getElementById(`btn-${cat}`);
        if (btn) {
            if (cat === categoriaActiva) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

// ============================================
// NAVEGACIÓN ENTRE VISTAS
// ============================================

function mostrarVista(vistaId) {
    document.querySelectorAll('.vista').forEach(v => v.classList.add('hidden'));
    document.getElementById(vistaId).classList.remove('hidden');
}

function mostrarBandeja() {
    mostrarVista('vista-bandeja');
    state.documentoActual = null;
    state.archivoTemporal = null;
    state.editando = false;
    state.contratoActual = null;
    state.archivoTemporalContrato = null;
    state.adjuntosTemporalesContrato = [];

    if (state.categoriaActual === 'contratos') {
        cargarContratos();
    } else {
        // Restaurar headers de tabla para documentos
        const colDocumento = document.getElementById('col-documento');
        if (colDocumento) {
            switch (state.categoriaActual) {
                case 'cartas-nemaec':
                case 'cartas-recibidas':
                    colDocumento.textContent = 'CARTA';
                    break;
                default:
                    colDocumento.textContent = 'OFICIO';
            }
        }
        cargarDocumentos();
    }
}

function mostrarFormularioNuevo() {
    if (state.categoriaActual === 'contratos') {
        mostrarFormularioNuevoContrato();
        return;
    }
    limpiarFormulario();
    document.getElementById('form-titulo').textContent = 'Nuevo Documento';
    state.editando = false;
    state.archivoTemporal = null;
    cargarDocumentosParaPadre();
    mostrarVista('vista-formulario');
}

function crearDocumentoRapido() {
    if (state.categoriaActual === 'contratos') {
        mostrarFormularioNuevoContrato();
        return;
    }

    limpiarFormulario();
    state.editando = false;
    state.archivoTemporal = null;

    // Pre-seleccionar el tipo según la categoría actual
    let tipoDocumento = '';
    let tituloFormulario = 'Nuevo Documento';

    switch (state.categoriaActual) {
        case 'cartas-nemaec':
            tipoDocumento = 'carta-nemaec';
            tituloFormulario = 'Nueva Carta NEMAEC';
            break;
        case 'oficios':
            tipoDocumento = 'oficio';
            tituloFormulario = 'Nuevo Oficio';
            break;
        case 'cartas-recibidas':
            tipoDocumento = 'carta-recibida';
            tituloFormulario = 'Nueva Carta Recibida';
            break;
    }

    document.getElementById('form-titulo').textContent = tituloFormulario;
    document.getElementById('doc-tipo').value = tipoDocumento;
    onTipoDocumentoChange();

    cargarDocumentosParaPadre();
    mostrarVista('vista-formulario');
}

function onTipoDocumentoChange() {
    const tipo = document.getElementById('doc-tipo').value;
    const direccionInput = document.getElementById('doc-direccion');
    const oficioRefContainer = document.getElementById('oficio-referencia-container');

    // Mapear tipo a dirección automáticamente
    switch (tipo) {
        case 'carta-nemaec':
            // CARTA NEMAEC = carta enviada
            direccionInput.value = 'enviado';
            // Mostrar campo de referencia para cartas NEMAEC
            oficioRefContainer.classList.remove('hidden');
            cargarOficiosParaReferencia();
            break;
        case 'oficio':
            // OFICIO = recibido
            direccionInput.value = 'recibido';
            oficioRefContainer.classList.add('hidden');
            break;
        case 'carta-recibida':
            // CARTA RECIBIDA = recibida
            direccionInput.value = 'recibido';
            oficioRefContainer.classList.add('hidden');
            break;
        default:
            direccionInput.value = '';
            oficioRefContainer.classList.add('hidden');
    }
}

async function cargarOficiosParaReferencia() {
    try {
        // Cargar todos los oficios (recibidos y enviados) para referencia
        const data = await apiListarDocumentos({ tipo_documento: 'oficio', por_pagina: 100 });
        state.oficiosDisponibles = data.documentos;

        const select = document.getElementById('doc-oficio-referencia');
        select.innerHTML = '<option value="">-- Sin oficio de referencia --</option>';

        data.documentos.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.numero || `ID: ${doc.id}`;
            option.dataset.asunto = doc.asunto || '';
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar oficios para referencia:', error);
    }
}

function onOficioReferenciaChange() {
    const select = document.getElementById('doc-oficio-referencia');
    const asuntoContainer = document.getElementById('oficio-referencia-asunto');
    const asuntoTexto = document.getElementById('oficio-ref-asunto-texto');

    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        const asunto = selectedOption.dataset.asunto;

        if (asunto) {
            asuntoTexto.textContent = asunto;
            asuntoContainer.classList.remove('hidden');
        } else {
            asuntoContainer.classList.add('hidden');
        }
    } else {
        asuntoContainer.classList.add('hidden');
    }
}

function seleccionarOficioPorNumero(numeroOficio) {
    if (!numeroOficio) return false;

    const select = document.getElementById('doc-oficio-referencia');
    const numeroNormalizado = numeroOficio.toUpperCase().replace(/\s+/g, '');

    console.log('Buscando oficio de referencia:', numeroOficio);

    // Extraer el número correlativo y año del oficio buscado
    const matchBuscado = numeroOficio.match(/(\d{5,6})-(\d{4})/);
    if (!matchBuscado) {
        console.log('No se pudo extraer correlativo del oficio:', numeroOficio);
        return false;
    }

    const correlativoBuscado = matchBuscado[1];
    const anioBuscado = matchBuscado[2];
    console.log('Buscando correlativo:', correlativoBuscado, 'año:', anioBuscado);

    // Buscar en las opciones
    for (let i = 0; i < select.options.length; i++) {
        const optionText = select.options[i].textContent.toUpperCase();

        // Buscar por correlativo y año
        if (optionText.includes(correlativoBuscado) && optionText.includes(anioBuscado)) {
            console.log('Encontrado:', optionText);
            select.value = select.options[i].value;
            onOficioReferenciaChange();
            return true;
        }
    }

    // Si no encontró con año, buscar solo por correlativo
    for (let i = 0; i < select.options.length; i++) {
        const optionText = select.options[i].textContent;
        if (optionText.includes(correlativoBuscado)) {
            console.log('Encontrado por correlativo:', optionText);
            select.value = select.options[i].value;
            onOficioReferenciaChange();
            return true;
        }
    }

    console.log('No se encontró el oficio en la lista');
    return false;
}

// ============================================
// BANDEJA DE DOCUMENTOS
// ============================================

async function cargarDocumentos() {
    // Determinar el ordenamiento según la categoría
    // - cartas-recibidas: ordenar por fecha del documento y fecha de subida
    // - oficios y cartas-nemaec: ordenar por número (año y correlativo)
    const ordenamiento = state.categoriaActual === 'cartas-recibidas' ? 'fecha' : 'numero';

    const filtros = {
        tipo_documento: document.getElementById('filtro-tipo').value,
        direccion: document.getElementById('filtro-direccion').value,
        busqueda: document.getElementById('filtro-busqueda').value,
        ordenar_por: ordenamiento,
        pagina: state.paginaActual,
        por_pagina: 100 // Cargar más para poder filtrar por referencia
    };

    try {
        // Si estamos en cartas-nemaec, cargar también los oficios para el mapa de referencias
        if (state.categoriaActual === 'cartas-nemaec') {
            try {
                const oficiosData = await apiListarDocumentos({ tipo_documento: 'oficio', por_pagina: 100 });
                state.oficiosDisponibles = oficiosData.documentos || [];
            } catch (err) {
                console.error('Error al cargar oficios para referencia:', err);
                state.oficiosDisponibles = [];
            }
        }

        let data = await apiListarDocumentos(filtros);

        // Filtrar por oficio de referencia si hay filtro
        const filtroReferenciaEl = document.getElementById('filtro-referencia');
        const filtroReferencia = filtroReferenciaEl ? filtroReferenciaEl.value.trim().toLowerCase() : '';
        if (filtroReferencia && state.categoriaActual === 'cartas-nemaec') {
            // Crear mapa de oficios
            const oficiosMap = {};
            if (state.oficiosDisponibles) {
                state.oficiosDisponibles.forEach(ofi => {
                    oficiosMap[ofi.id] = (ofi.numero || '').toLowerCase();
                });
            }

            // Filtrar documentos que tienen referencia que coincide
            const documentosFiltrados = data.documentos.filter(doc => {
                if (!doc.documento_padre_id) return false;
                const numReferencia = oficiosMap[doc.documento_padre_id] || '';
                return numReferencia.includes(filtroReferencia);
            });

            data = {
                ...data,
                documentos: documentosFiltrados,
                total: documentosFiltrados.length
            };
        }

        renderizarDocumentos(data);
    } catch (error) {
        console.error('Error al cargar documentos:', error);
        const mensaje = error.message || error.toString() || 'Error desconocido';
        mostrarToast('Error al cargar documentos: ' + mensaje, 'error');
    }
}

function renderizarDocumentos(data) {
    const container = document.getElementById('lista-documentos');
    const totalEl = document.getElementById('total-docs');

    totalEl.textContent = `${data.total} documento(s) encontrado(s)`;

    // Determinar colspan según si se muestra la columna de referencia
    const colspan = state.categoriaActual === 'cartas-nemaec' ? 7 : 6;

    const esAdmin = estaAutenticado();

    if (data.documentos.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="px-4 py-8 text-center">
                    <div class="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 mx-auto text-gray-400 mb-4">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p class="text-gray-500 mb-4">No hay documentos registrados</p>
                        ${esAdmin ? `
                        <button onclick="mostrarFormularioNuevo()"
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            Registrar primer documento
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Calcular número de fila basado en paginación
    const offset = (data.pagina - 1) * data.por_pagina;

    // Verificar si mostrar columna de referencia (solo para cartas-nemaec)
    const mostrarReferencia = state.categoriaActual === 'cartas-nemaec';

    // Crear mapa de oficios para buscar el número del documento padre
    const oficiosMap = {};
    if (state.oficiosDisponibles) {
        state.oficiosDisponibles.forEach(ofi => {
            oficiosMap[ofi.id] = ofi.numero || `ID: ${ofi.id}`;
        });
    }

    // Clase para ocultar/mostrar columna de referencia
    const claseReferencia = mostrarReferencia ? '' : 'hidden';

    container.innerHTML = data.documentos.map((doc, index) => {
        // Obtener número del oficio de referencia si existe
        const oficioRef = doc.documento_padre_id ? (oficiosMap[doc.documento_padre_id] || '-') : '-';

        return `
        <tr class="documento-row hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900 font-medium cursor-pointer" onclick="verDetalle(${doc.id})">${offset + index + 1}</td>
            <td class="px-4 py-3 text-sm text-blue-600 font-medium cursor-pointer" onclick="verDetalle(${doc.id})">${doc.numero || 'Sin número'}</td>
            <td class="px-4 py-3 text-sm text-purple-600 cursor-pointer ${claseReferencia}" onclick="verDetalle(${doc.id})" title="Oficio de referencia">${oficioRef}</td>
            <td class="px-4 py-3 text-sm text-gray-600 cursor-pointer" onclick="verDetalle(${doc.id})">${formatearFecha(doc.fecha)}</td>
            <td class="px-4 py-3 text-sm text-gray-900 cursor-pointer" onclick="verDetalle(${doc.id})">${doc.asunto || 'Sin asunto'}</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate cursor-pointer" onclick="verDetalle(${doc.id})" title="${doc.resumen || ''}">${truncarTexto(doc.resumen, 100) || '-'}</td>
            ${esAdmin ? `
            <td class="px-4 py-3 text-center">
                <button onclick="confirmarEliminar(${doc.id}, '${(doc.numero || '').replace(/'/g, "\\'")}'); event.stopPropagation();"
                        class="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition"
                        title="Eliminar documento">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </td>
            ` : '<td></td>'}
        </tr>
    `}).join('');

    // Renderizar paginación
    renderizarPaginacion(data.total, data.pagina, data.por_pagina);
}

function renderizarPaginacion(total, pagina, porPagina) {
    const totalPaginas = Math.ceil(total / porPagina);
    const container = document.getElementById('paginacion');

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Botón anterior
    if (pagina > 1) {
        html += `<button onclick="irAPagina(${pagina - 1})"
                         class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">Anterior</button>`;
    }

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === pagina) {
            html += `<button class="px-3 py-1 bg-blue-600 text-white rounded">${i}</button>`;
        } else if (i === 1 || i === totalPaginas || (i >= pagina - 2 && i <= pagina + 2)) {
            html += `<button onclick="irAPagina(${i})"
                             class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">${i}</button>`;
        } else if (i === pagina - 3 || i === pagina + 3) {
            html += `<span class="px-2">...</span>`;
        }
    }

    // Botón siguiente
    if (pagina < totalPaginas) {
        html += `<button onclick="irAPagina(${pagina + 1})"
                         class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">Siguiente</button>`;
    }

    container.innerHTML = html;
}

function irAPagina(pagina) {
    state.paginaActual = pagina;
    if (state.categoriaActual === 'contratos') {
        cargarContratos();
    } else {
        cargarDocumentos();
    }
}

// ============================================
// DETALLE DE DOCUMENTO
// ============================================

async function verDetalle(id) {
    try {
        const doc = await apiObtenerDocumento(id);
        state.documentoActual = doc;
        renderizarDetalle(doc);
        mostrarVista('vista-detalle');
    } catch (error) {
        mostrarToast('Error al cargar documento: ' + error.message, 'error');
    }
}

async function renderizarDetalle(doc) {
    // Badge
    const badge = document.getElementById('det-badge');
    badge.textContent = `${capitalizar(doc.tipo_documento)} ${capitalizar(doc.direccion)}`;
    badge.className = `inline-block px-3 py-1 rounded-full text-sm font-medium badge-${doc.tipo_documento}-${doc.direccion}`;

    // Datos básicos
    document.getElementById('det-titulo').textContent = doc.titulo || 'Sin título';
    document.getElementById('det-numero').textContent = doc.numero || '-';
    document.getElementById('det-fecha').textContent = doc.fecha ? formatearFecha(doc.fecha) : '-';
    document.getElementById('det-remitente').textContent = doc.remitente || '-';
    document.getElementById('det-destinatario').textContent = doc.destinatario || '-';
    document.getElementById('det-asunto').textContent = doc.asunto || 'No especificado';
    document.getElementById('det-resumen').textContent = doc.resumen || 'No hay resumen disponible';

    // Archivo principal
    const archivoContainer = document.getElementById('det-archivo');
    if (doc.archivo_local) {
        archivoContainer.innerHTML = `
            <a href="${window.location.origin}/uploads/${doc.archivo_local}" target="_blank"
               class="link-documento flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
                Ver PDF
            </a>
        `;
    } else if (doc.enlace_drive) {
        archivoContainer.innerHTML = `
            <a href="${doc.enlace_drive}" target="_blank"
               class="link-documento flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Ver en Google Drive
            </a>
        `;
    } else {
        archivoContainer.innerHTML = '<p class="text-gray-500">No hay documento adjunto</p>';
    }

    // Adjuntos
    const adjuntosContainer = document.getElementById('det-adjuntos');
    if (doc.adjuntos && doc.adjuntos.length > 0) {
        adjuntosContainer.innerHTML = doc.adjuntos.map(adj => `
            <div class="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition">
                <svg class="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                </svg>
                <a href="${adj.archivo_local ? `${window.location.origin}/uploads/${adj.archivo_local}` : adj.enlace_drive}"
                   target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline flex-1">
                    ${adj.nombre || adj.archivo_local || 'Adjunto'}
                </a>
            </div>
        `).join('');
    } else {
        adjuntosContainer.innerHTML = '<p class="text-gray-500 italic">No hay adjuntos</p>';
    }

    // Sección de respuestas (solo para documentos recibidos)
    const seccionRespuestas = document.getElementById('seccion-respuestas');
    if (doc.direccion === 'recibido') {
        seccionRespuestas.classList.remove('hidden');
        cargarRespuestas(doc.id);
    } else {
        seccionRespuestas.classList.add('hidden');
    }
}

async function cargarRespuestas(documentoId) {
    try {
        const respuestas = await apiObtenerRespuestas(documentoId);
        const container = document.getElementById('lista-respuestas');

        if (respuestas.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No hay respuestas registradas</p>';
            return;
        }

        container.innerHTML = respuestas.map(resp => `
            <div class="py-2 border-b last:border-0 cursor-pointer hover:bg-gray-50"
                 onclick="verDetalle(${resp.id})">
                <div class="font-medium">${resp.titulo || 'Sin título'}</div>
                <div class="text-sm text-gray-500">${formatearFecha(resp.created_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error al cargar respuestas:', error);
    }
}

// ============================================
// FORMULARIO DE DOCUMENTO
// ============================================

function limpiarFormulario() {
    document.getElementById('doc-id').value = '';
    document.getElementById('doc-tipo').value = '';
    document.getElementById('doc-direccion').value = '';
    document.getElementById('doc-numero').value = '';
    document.getElementById('doc-fecha').value = '';
    document.getElementById('doc-remitente').value = '';
    document.getElementById('doc-destinatario').value = '';
    document.getElementById('doc-titulo').value = '';
    document.getElementById('doc-asunto').value = '';
    document.getElementById('doc-resumen').value = '';
    document.getElementById('doc-enlace').value = '';
    document.getElementById('doc-archivo').value = '';
    document.getElementById('doc-padre').value = '';
    document.getElementById('archivo-status').innerHTML = '';
    document.getElementById('ia-error').classList.add('hidden');
    document.getElementById('doc-whatsapp').value = '';
    document.getElementById('whatsapp-container').classList.add('hidden');
    // Limpiar campo de oficio de referencia
    document.getElementById('doc-oficio-referencia').value = '';
    document.getElementById('oficio-referencia-container').classList.add('hidden');
    document.getElementById('oficio-referencia-asunto').classList.add('hidden');
    // Limpiar adjuntos
    state.adjuntosTemporales = [];
    document.getElementById('lista-adjuntos-form').innerHTML = '';
    state.archivoTemporal = null;
}

function editarDocumento() {
    const doc = state.documentoActual;
    if (!doc) return;

    document.getElementById('form-titulo').textContent = 'Editar Documento';
    document.getElementById('doc-id').value = doc.id;

    // Mapear tipo_documento y direccion del backend al nuevo tipo del frontend
    let tipoFrontend;
    if (doc.tipo_documento === 'carta' && doc.direccion === 'enviado') {
        tipoFrontend = 'carta-nemaec';
    } else if (doc.tipo_documento === 'oficio') {
        tipoFrontend = 'oficio';
    } else if (doc.tipo_documento === 'carta' && doc.direccion === 'recibido') {
        tipoFrontend = 'carta-recibida';
    } else {
        tipoFrontend = doc.tipo_documento;
    }

    document.getElementById('doc-tipo').value = tipoFrontend;
    document.getElementById('doc-direccion').value = doc.direccion;
    document.getElementById('doc-numero').value = doc.numero || '';
    document.getElementById('doc-fecha').value = doc.fecha ? doc.fecha.split('T')[0] : '';
    document.getElementById('doc-remitente').value = doc.remitente || '';
    document.getElementById('doc-destinatario').value = doc.destinatario || '';
    document.getElementById('doc-titulo').value = doc.titulo || '';
    document.getElementById('doc-asunto').value = doc.asunto || '';
    document.getElementById('doc-resumen').value = doc.resumen || '';
    document.getElementById('doc-enlace').value = doc.enlace_drive || '';

    if (doc.archivo_local) {
        document.getElementById('archivo-status').innerHTML = `Archivo actual: <a href="${window.location.origin}/uploads/${doc.archivo_local}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${doc.archivo_local}</a>`;
    }

    // Activar la lógica de cambio de tipo para mostrar/ocultar campos
    onTipoDocumentoChange();

    // Renderizar adjuntos existentes
    renderizarAdjuntosForm();

    state.editando = true;
    cargarDocumentosParaPadre();
    mostrarVista('vista-formulario');
}

async function cargarDocumentosParaPadre() {
    try {
        // Cargar documentos recibidos para poder seleccionarlos como padre
        const data = await apiListarDocumentos({ direccion: 'recibido', por_pagina: 100 });
        const select = document.getElementById('doc-padre');

        select.innerHTML = '<option value="">Ninguno (documento nuevo)</option>';
        data.documentos.forEach(doc => {
            // No mostrar el documento actual si estamos editando
            if (state.documentoActual && doc.id === state.documentoActual.id) return;

            select.innerHTML += `
                <option value="${doc.id}">
                    ${doc.numero || 'S/N'} - ${doc.titulo || 'Sin título'}
                </option>
            `;
        });

        // Seleccionar padre si existe
        if (state.documentoActual && state.documentoActual.documento_padre_id) {
            select.value = state.documentoActual.documento_padre_id;
        }
    } catch (error) {
        console.error('Error al cargar documentos para padre:', error);
    }
}

async function guardarDocumento(event) {
    event.preventDefault();

    const docId = document.getElementById('doc-id').value;
    const numeroOficio = document.getElementById('doc-numero').value || null;
    const tipoSeleccionado = document.getElementById('doc-tipo').value;

    // Mapear el tipo seleccionado a tipo_documento y direccion para el backend
    let tipoDocumento, direccion;
    switch (tipoSeleccionado) {
        case 'carta-nemaec':
            tipoDocumento = 'carta';
            direccion = 'enviado';
            break;
        case 'oficio':
            tipoDocumento = 'oficio';
            direccion = 'recibido';
            break;
        case 'carta-recibida':
            tipoDocumento = 'carta';
            direccion = 'recibido';
            break;
        default:
            tipoDocumento = tipoSeleccionado;
            direccion = document.getElementById('doc-direccion').value;
    }

    // Determinar documento padre: primero el oficio de referencia, luego el campo padre tradicional
    let documentoPadreId = document.getElementById('doc-oficio-referencia').value ||
                           document.getElementById('doc-padre').value || null;

    const documento = {
        tipo_documento: tipoDocumento,
        direccion: direccion,
        numero: numeroOficio,
        fecha: document.getElementById('doc-fecha').value || null,
        remitente: document.getElementById('doc-remitente').value || null,
        destinatario: document.getElementById('doc-destinatario').value || null,
        titulo: numeroOficio, // El título es el número de oficio
        asunto: document.getElementById('doc-asunto').value || null,
        resumen: document.getElementById('doc-resumen').value || null,
        enlace_drive: document.getElementById('doc-enlace').value || null,
        documento_padre_id: documentoPadreId
    };

    // Función para ir a la bandeja correspondiente según el tipo
    function irABandejaCorrespondiente() {
        mostrarVista('vista-bandeja');
        state.documentoActual = null;
        state.archivoTemporal = null;
        state.editando = false;

        switch (tipoSeleccionado) {
            case 'carta-nemaec':
                filtrarPorCategoria('cartas-nemaec');
                break;
            case 'oficio':
                filtrarPorCategoria('oficios');
                break;
            case 'carta-recibida':
                filtrarPorCategoria('cartas-recibidas');
                break;
            default:
                filtrarPorCategoria('oficios');
        }
    }

    try {
        let resultado;

        if (docId) {
            // Actualizar documento existente
            resultado = await apiActualizarDocumento(docId, documento);

            // Subir adjuntos temporales si hay
            if (state.adjuntosTemporales.length > 0) {
                await subirAdjuntosTemporales(docId);
            }

            mostrarToast('Documento actualizado correctamente');
            irABandejaCorrespondiente();
        } else {
            // Verificar si ya existe un documento con el mismo número
            let documentoExistente = null;
            if (numeroOficio) {
                const busqueda = await apiListarDocumentos({ busqueda: numeroOficio, por_pagina: 100 });
                documentoExistente = busqueda.documentos.find(doc =>
                    doc.numero && doc.numero.toLowerCase() === numeroOficio.toLowerCase()
                );
            }

            if (documentoExistente) {
                // Mostrar SweetAlert preguntando si desea reemplazar
                const confirmacion = await Swal.fire({
                    title: 'Documento ya existe',
                    html: `Ya existe un documento con el número <strong>${numeroOficio}</strong>.<br><br>¿Desea reemplazarlo?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Sí, reemplazar',
                    cancelButtonText: 'Cancelar'
                });

                if (confirmacion.isConfirmed) {
                    // Actualizar el documento existente
                    resultado = await apiActualizarDocumento(documentoExistente.id, documento);

                    // Si hay archivo temporal, asociarlo al documento
                    if (state.archivoTemporal) {
                        await apiAsociarArchivoTemporal(documentoExistente.id, state.archivoTemporal);
                    }

                    // Subir adjuntos temporales si hay
                    if (state.adjuntosTemporales.length > 0) {
                        await subirAdjuntosTemporales(documentoExistente.id);
                    }

                    mostrarToast('Documento reemplazado correctamente');
                    irABandejaCorrespondiente();
                }
                // Si cancela, no hace nada y el usuario puede seguir editando
            } else {
                // Crear nuevo documento
                resultado = await apiCrearDocumento(documento);

                // Si hay archivo temporal, asociarlo al documento
                if (state.archivoTemporal) {
                    await apiAsociarArchivoTemporal(resultado.id, state.archivoTemporal);
                }

                // Subir adjuntos temporales si hay
                if (state.adjuntosTemporales.length > 0) {
                    await subirAdjuntosTemporales(resultado.id);
                }

                mostrarToast('Documento creado correctamente');
                irABandejaCorrespondiente();
            }
        }
    } catch (error) {
        mostrarToast('Error: ' + error.message, 'error');
    }
}

async function eliminarDocumento() {
    if (!state.documentoActual) return;

    if (!confirm('¿Está seguro de eliminar este documento?')) return;

    try {
        await apiEliminarDocumento(state.documentoActual.id);
        mostrarToast('Documento eliminado');
        mostrarBandeja();
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
}

async function confirmarEliminar(id, numero) {
    const mensaje = numero
        ? `¿Está seguro de querer borrar el oficio ${numero}?`
        : '¿Está seguro de querer borrar este documento?';

    if (!confirm(mensaje)) return;

    try {
        await apiEliminarDocumento(id);
        mostrarToast('Documento eliminado correctamente');
        cargarDocumentos(); // Recargar la lista
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
}

// ============================================
// MANEJO DE ADJUNTOS
// ============================================

function agregarAdjuntos() {
    const inputAdjunto = document.getElementById('nuevo-adjunto');
    const archivos = inputAdjunto.files;

    if (!archivos || archivos.length === 0) {
        mostrarToast('Seleccione al menos un archivo para adjuntar', 'error');
        return;
    }

    let agregados = 0;
    let duplicados = 0;

    // Procesar todos los archivos seleccionados
    for (const archivo of archivos) {
        // Verificar si ya existe un adjunto con el mismo nombre
        const yaExiste = state.adjuntosTemporales.some(adj => adj.name === archivo.name);
        if (yaExiste) {
            duplicados++;
            continue;
        }

        // Agregar al estado
        state.adjuntosTemporales.push(archivo);
        agregados++;
    }

    // Actualizar la lista visual
    renderizarAdjuntosForm();

    // Limpiar el input
    inputAdjunto.value = '';

    // Mostrar mensaje apropiado
    if (agregados > 0 && duplicados === 0) {
        mostrarToast(`${agregados} adjunto${agregados > 1 ? 's' : ''} agregado${agregados > 1 ? 's' : ''}`);
    } else if (agregados > 0 && duplicados > 0) {
        mostrarToast(`${agregados} agregado${agregados > 1 ? 's' : ''}, ${duplicados} duplicado${duplicados > 1 ? 's' : ''} omitido${duplicados > 1 ? 's' : ''}`);
    } else if (duplicados > 0) {
        mostrarToast('Los archivos ya están en la lista', 'error');
    }
}

function removerAdjunto(index) {
    state.adjuntosTemporales.splice(index, 1);
    renderizarAdjuntosForm();
}

async function removerAdjuntoExistente(adjuntoId) {
    const confirmacion = await Swal.fire({
        title: '¿Eliminar adjunto?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        try {
            await apiEliminarAdjunto(adjuntoId);
            mostrarToast('Adjunto eliminado');
            // Recargar el documento para actualizar la lista
            if (state.documentoActual) {
                const docActualizado = await apiObtenerDocumento(state.documentoActual.id);
                state.documentoActual = docActualizado;
                renderizarAdjuntosExistentes();
            }
        } catch (error) {
            mostrarToast('Error al eliminar adjunto: ' + error.message, 'error');
        }
    }
}

function renderizarAdjuntosForm() {
    const container = document.getElementById('lista-adjuntos-form');

    // Renderizar adjuntos existentes (si estamos editando)
    let htmlExistentes = '';
    if (state.documentoActual && state.documentoActual.adjuntos && state.documentoActual.adjuntos.length > 0) {
        htmlExistentes = '<div class="mb-3"><p class="text-sm font-medium text-gray-600 mb-2">Adjuntos guardados:</p>';
        htmlExistentes += state.documentoActual.adjuntos.map(adj => `
            <div class="flex items-center justify-between bg-white p-2 rounded border mb-1">
                <a href="${adj.archivo_local ? `${window.location.origin}/uploads/${adj.archivo_local}` : adj.enlace_drive}"
                   target="_blank" class="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    ${adj.nombre || adj.archivo_local || 'Adjunto'}
                </a>
                <button type="button" onclick="removerAdjuntoExistente(${adj.id})"
                        class="text-red-500 hover:text-red-700 p-1" title="Eliminar adjunto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
        htmlExistentes += '</div>';
    }

    // Renderizar adjuntos temporales (nuevos)
    let htmlTemporales = '';
    if (state.adjuntosTemporales.length > 0) {
        htmlTemporales = '<div><p class="text-sm font-medium text-gray-600 mb-2">Nuevos adjuntos por guardar:</p>';
        htmlTemporales += state.adjuntosTemporales.map((archivo, index) => `
            <div class="flex items-center justify-between bg-orange-100 p-2 rounded border border-orange-300 mb-1">
                <span class="text-sm text-gray-700 flex items-center gap-2">
                    <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    ${archivo.name}
                </span>
                <button type="button" onclick="removerAdjunto(${index})"
                        class="text-red-500 hover:text-red-700 p-1" title="Quitar adjunto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
        htmlTemporales += '</div>';
    }

    container.innerHTML = htmlExistentes + htmlTemporales;
}

function renderizarAdjuntosExistentes() {
    renderizarAdjuntosForm();
}

async function subirAdjuntosTemporales(documentoId) {
    for (const archivo of state.adjuntosTemporales) {
        try {
            await apiAgregarAdjunto(documentoId, archivo, null, archivo.name);
        } catch (error) {
            console.error('Error al subir adjunto:', archivo.name, error);
        }
    }
    state.adjuntosTemporales = [];
}

// ============================================
// SUBIDA DE ARCHIVOS
// ============================================

async function subirArchivo() {
    const archivo = document.getElementById('doc-archivo').files[0];
    if (!archivo) {
        mostrarToast('Seleccione un archivo PDF', 'error');
        return;
    }

    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
        mostrarToast('Solo se permiten archivos PDF', 'error');
        return;
    }

    const statusEl = document.getElementById('archivo-status');
    statusEl.textContent = 'Subiendo archivo...';

    try {
        const resultado = await apiSubirArchivoTemporal(archivo);
        state.archivoTemporal = resultado.archivo;
        statusEl.innerHTML = `Archivo subido: <a href="${window.location.origin}/uploads/${resultado.archivo}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${resultado.archivo}</a>`;
        mostrarToast('Archivo subido correctamente');
    } catch (error) {
        statusEl.innerHTML = '<span class="text-red-600">Error al subir archivo</span>';
        mostrarToast('Error: ' + error.message, 'error');
    }
}

// ============================================
// ANÁLISIS CON IA
// ============================================

async function analizarConIA() {
    const btn = document.getElementById('btn-analizar');
    const loadingEl = document.getElementById('ia-loading');
    const errorEl = document.getElementById('ia-error');

    // Verificar que hay un archivo subido
    if (!state.archivoTemporal) {
        mostrarToast('Primero suba un archivo PDF', 'error');
        return;
    }

    // Mostrar estado de carga
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Analizando...';
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
        const resultado = await apiAnalizarArchivo(state.archivoTemporal);

        if (resultado.exito) {
            console.log('Resultado IAO:', resultado); // Para depuración

            // Llenar TODOS los campos con resultados
            document.getElementById('doc-numero').value = resultado.numero_oficio || '';

            // Fecha - convertir a formato de input date
            if (resultado.fecha && resultado.fecha !== 'No especificado' && resultado.fecha.length >= 10) {
                document.getElementById('doc-fecha').value = resultado.fecha.substring(0, 10);
            }

            // Remitente
            const remitente = resultado.remitente || '';
            if (remitente && remitente !== 'No especificado') {
                document.getElementById('doc-remitente').value = remitente;
            }

            // Destinatario
            const destinatario = resultado.destinatario || '';
            if (destinatario && destinatario !== 'No especificado') {
                document.getElementById('doc-destinatario').value = destinatario;
            }

            // Asunto y Resumen
            document.getElementById('doc-asunto').value = resultado.asunto || '';
            document.getElementById('doc-resumen').value = resultado.resumen || '';

            // Mensaje WhatsApp - usar directamente numero_oficio del resultado
            if (resultado.numero_oficio) {
                const mensajeWhatsapp = `${resultado.numero_oficio}\nAsunto: ${resultado.asunto || ''}\nResumen: ${resultado.resumen || ''}`;
                document.getElementById('doc-whatsapp').value = mensajeWhatsapp;
                document.getElementById('whatsapp-container').classList.remove('hidden');
            }

            // Auto-seleccionar tipo basado en el número detectado
            if (resultado.numero_oficio) {
                if (resultado.numero_oficio.toLowerCase().includes('oficio')) {
                    document.getElementById('doc-tipo').value = 'oficio';
                    onTipoDocumentoChange();
                } else if (resultado.numero_oficio.toLowerCase().includes('carta')) {
                    // Si es carta NEMAEC (enviada)
                    document.getElementById('doc-tipo').value = 'carta-nemaec';
                    onTipoDocumentoChange();
                }
            }

            // Si la IA detectó un oficio de referencia, intentar seleccionarlo
            if (resultado.oficio_referencia) {
                console.log('Oficio de referencia detectado por IA:', resultado.oficio_referencia);
                // Esperar a que se carguen los oficios y luego seleccionar
                setTimeout(() => {
                    seleccionarOficioPorNumero(resultado.oficio_referencia);
                }, 500);
            }

            mostrarToast('Análisis completado. Revise y edite los campos.');
        } else {
            errorEl.textContent = resultado.mensaje;
            errorEl.classList.remove('hidden');
            mostrarToast('Error en análisis: ' + resultado.mensaje, 'error');
        }
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        mostrarToast('Error: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            Analizar con IA
        `;
        loadingEl.classList.add('hidden');
    }
}

// ============================================
// CREAR RESPUESTA
// ============================================

function crearRespuesta() {
    const docPadre = state.documentoActual;
    if (!docPadre) return;

    limpiarFormulario();
    document.getElementById('form-titulo').textContent = 'Nueva Carta de Respuesta';
    document.getElementById('doc-tipo').value = 'carta-nemaec';
    onTipoDocumentoChange();

    // Pre-llenar con datos del documento padre
    document.getElementById('doc-destinatario').value = docPadre.remitente || '';

    // Cargar documentos padre y seleccionar el actual
    cargarDocumentosParaPadre().then(() => {
        document.getElementById('doc-padre').value = docPadre.id;
    });

    state.editando = false;
    mostrarVista('vista-formulario');
}

// ============================================
// UTILIDADES
// ============================================

function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncarTexto(texto, maxLength) {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength) + '...';
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toast-message');

    messageEl.textContent = mensaje;
    toast.querySelector('div').className = tipo === 'error'
        ? 'bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg'
        : 'bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg';

    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 3000);
}

function copiarWhatsApp() {
    const texto = document.getElementById('doc-whatsapp').value;
    if (!texto) {
        mostrarToast('No hay mensaje para copiar', 'error');
        return;
    }

    navigator.clipboard.writeText(texto).then(() => {
        mostrarToast('Mensaje copiado al portapapeles');
    }).catch(err => {
        // Fallback para navegadores sin soporte
        const textarea = document.getElementById('doc-whatsapp');
        textarea.select();
        document.execCommand('copy');
        mostrarToast('Mensaje copiado al portapapeles');
    });
}

function buscarSegunCategoria() {
    if (state.categoriaActual === 'contratos') {
        cargarContratos();
    } else {
        cargarDocumentos();
    }
}

function restaurarHeadersTablaDocumentos() {
    const thead = document.querySelector('#lista-documentos')?.closest('table')?.querySelector('thead tr');
    if (!thead) return;
    // Solo restaurar si los headers fueron modificados (ej. por contratos)
    const colDocumento = document.getElementById('col-documento');
    if (!colDocumento) {
        thead.innerHTML = `
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NRO</th>
            <th id="col-documento" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OFICIO</th>
            <th id="col-referencia" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden">OFICIO REF.</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FECHA ENVÍO</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ASUNTO</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RESUMEN</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
        `;
    }
}

// ============================================
// CONTRATOS - CRUD COMPLETO
// ============================================

async function cargarContratos() {
    const busqueda = document.getElementById('filtro-busqueda').value;

    try {
        const data = await apiListarContratos({
            busqueda: busqueda,
            pagina: state.paginaActual,
            por_pagina: 100
        });
        // Guardar datos originales para filtros en frontend
        state.contratosOriginales = data.contratos;
        state.contratosFiltrados = [...data.contratos];

        // Poblar dropdown de contratados
        poblarDropdownContratados(data.contratos);

        // Aplicar filtros actuales
        aplicarFiltrosContratos();
    } catch (error) {
        console.error('Error al cargar contratos:', error);
        mostrarToast('Error al cargar contratos: ' + (error.message || 'Error desconocido'), 'error');
    }
}

// Poblar dropdown de contratados con valores únicos
function poblarDropdownContratados(contratos) {
    const select = document.getElementById('filtro-contratado');
    if (!select) return;

    const contratadosUnicos = [...new Set(contratos
        .map(c => c.contratado)
        .filter(c => c && c.trim() !== '')
    )].sort();

    select.innerHTML = '<option value="">-- Todos --</option>' +
        contratadosUnicos.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Aplicar todos los filtros en el frontend
function aplicarFiltrosContratos() {
    let contratos = [...state.contratosOriginales];

    // Filtro por tipo de contrato
    const filtroEquipamiento = document.getElementById('filtro-equipamiento');
    const filtroMantenimiento = document.getElementById('filtro-mantenimiento');
    const tiposSeleccionados = [];
    if (filtroEquipamiento && filtroEquipamiento.checked) tiposSeleccionados.push('equipamiento');
    if (filtroMantenimiento && filtroMantenimiento.checked) tiposSeleccionados.push('mantenimiento');

    if (tiposSeleccionados.length > 0 && tiposSeleccionados.length < 2) {
        contratos = contratos.filter(c => tiposSeleccionados.includes(c.tipo_contrato));
    }

    // Filtro por contratado
    const filtroContratado = document.getElementById('filtro-contratado')?.value;
    if (filtroContratado) {
        contratos = contratos.filter(c => c.contratado === filtroContratado);
    }

    // Filtro por fecha inicio
    const filtroFechaInicioOp = document.getElementById('filtro-fecha-inicio-op')?.value;
    const filtroFechaInicio = document.getElementById('filtro-fecha-inicio')?.value;
    if (filtroFechaInicioOp && filtroFechaInicio) {
        const fechaFiltro = new Date(filtroFechaInicio + 'T00:00:00');
        contratos = contratos.filter(c => {
            if (!c.fecha || !c.plazo_dias) return false;
            const fechaContrato = new Date(c.fecha);
            const fechaInicio = new Date(fechaContrato);
            fechaInicio.setDate(fechaInicio.getDate() + 1);

            if (filtroFechaInicioOp === '>=') return fechaInicio >= fechaFiltro;
            if (filtroFechaInicioOp === '<=') return fechaInicio <= fechaFiltro;
            return true;
        });
    }

    // Filtro por fecha fin
    const filtroFechaFinOp = document.getElementById('filtro-fecha-fin-op')?.value;
    const filtroFechaFin = document.getElementById('filtro-fecha-fin')?.value;
    if (filtroFechaFinOp && filtroFechaFin) {
        const fechaFiltro = new Date(filtroFechaFin + 'T00:00:00');
        contratos = contratos.filter(c => {
            if (!c.fecha || !c.plazo_dias) return false;
            const fechaContrato = new Date(c.fecha);
            const fechaInicio = new Date(fechaContrato);
            fechaInicio.setDate(fechaInicio.getDate() + 1);
            const totalDias = c.plazo_dias + (c.dias_adicionales || 0);
            const fechaFin = new Date(fechaInicio);
            fechaFin.setDate(fechaFin.getDate() + totalDias - 1);

            if (filtroFechaFinOp === '>=') return fechaFin >= fechaFiltro;
            if (filtroFechaFinOp === '<=') return fechaFin <= fechaFiltro;
            return true;
        });
    }

    // Filtro por monto
    const filtroMontoOp = document.getElementById('filtro-monto-op')?.value;
    const filtroMonto = document.getElementById('filtro-monto')?.value;
    if (filtroMontoOp && filtroMonto) {
        const montoFiltro = parseFloat(filtroMonto);
        contratos = contratos.filter(c => {
            if (c.monto_total === null || c.monto_total === undefined) return false;
            if (filtroMontoOp === '>=') return c.monto_total >= montoFiltro;
            if (filtroMontoOp === '<=') return c.monto_total <= montoFiltro;
            return true;
        });
    }

    // Filtro por estado
    const filtroEstado = document.getElementById('filtro-estado')?.value;
    if (filtroEstado) {
        contratos = contratos.filter(c => (c.estado_ejecucion || 'PENDIENTE') === filtroEstado);
    }

    state.contratosFiltrados = contratos;

    // Renderizar con datos filtrados
    renderizarContratos({
        contratos: contratos,
        total: contratos.length,
        pagina: 1,
        por_pagina: 100
    });
}

// Limpiar todos los filtros
function limpiarFiltrosContratos() {
    document.getElementById('filtro-equipamiento').checked = true;
    document.getElementById('filtro-mantenimiento').checked = true;
    document.getElementById('filtro-contratado').value = '';
    document.getElementById('filtro-fecha-inicio-op').value = '';
    document.getElementById('filtro-fecha-inicio').value = '';
    document.getElementById('filtro-fecha-fin-op').value = '';
    document.getElementById('filtro-fecha-fin').value = '';
    document.getElementById('filtro-monto-op').value = '';
    document.getElementById('filtro-monto').value = '';
    document.getElementById('filtro-estado').value = '';

    aplicarFiltrosContratos();
}

// Descargar Excel con los contratos filtrados
function descargarExcelContratos() {
    const contratos = state.contratosFiltrados;
    if (!contratos || contratos.length === 0) {
        mostrarToast('No hay contratos para descargar', 'error');
        return;
    }

    // Función para calcular fechas en formato DD/MM/YYYY
    const calcularFechas = (contrato) => {
        if (!contrato.fecha || !contrato.plazo_dias) return { inicio: '', fin: '' };
        const fechaContrato = new Date(contrato.fecha);
        const fechaInicio = new Date(fechaContrato);
        fechaInicio.setDate(fechaInicio.getDate() + 1);
        const totalDias = contrato.plazo_dias + (contrato.dias_adicionales || 0);
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + totalDias - 1);
        const formatoFecha = (f) => {
            const d = f.getDate().toString().padStart(2, '0');
            const m = (f.getMonth() + 1).toString().padStart(2, '0');
            const y = f.getFullYear();
            return `${d}/${m}/${y}`;
        };
        return { inicio: formatoFecha(fechaInicio), fin: formatoFecha(fechaFin) };
    };

    // Limpiar texto para CSV (remover punto y coma y comillas)
    const limpiarTexto = (texto) => {
        if (!texto) return '';
        return String(texto).replace(/;/g, ',').replace(/"/g, '').replace(/\n/g, ' ').trim();
    };

    // BOM para UTF-8 en Excel
    const BOM = '\uFEFF';

    // Encabezados - usar punto y coma para Excel en español
    const headers = 'NRO;CONTRATO;TIPO;ITEM_CONTRATADO;CONTRATADO;F_INICIO;F_FIN;MONTO;ESTADO';

    let totalMonto = 0;
    const rows = contratos.map((c, i) => {
        const fechas = calcularFechas(c);
        const monto = c.monto_total || 0;
        totalMonto += monto;
        return [
            i + 1,
            limpiarTexto(c.numero),
            limpiarTexto(c.tipo_contrato),
            limpiarTexto(c.item_contratado),
            limpiarTexto(c.contratado),
            fechas.inicio,
            fechas.fin,
            monto,
            limpiarTexto(c.estado_ejecucion || 'PENDIENTE')
        ].join(';');
    });

    // Fila de total al final
    const filaTotal = ['', '', '', '', '', '', 'TOTAL:', totalMonto.toFixed(2), ''].join(';');

    // CSV con BOM y punto y coma como separador
    const csv = BOM + headers + '\n' + rows.join('\n') + '\n' + filaTotal;

    // Descargar archivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().split('T')[0];
    link.download = `contratos_${fecha}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    mostrarToast(`Descargados ${contratos.length} contratos`);
}

function sortIconContrato(col) {
    if (state.contratosSortColumn !== col) return '<span class="text-gray-300 ml-1">↕</span>';
    return state.contratosSortDir === 'asc'
        ? '<span class="text-orange-500 ml-1">↑</span>'
        : '<span class="text-orange-500 ml-1">↓</span>';
}

function sortContratos(columna) {
    if (state.contratosSortColumn === columna) {
        state.contratosSortDir = state.contratosSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        state.contratosSortColumn = columna;
        state.contratosSortDir = 'asc';
    }
    const dir = state.contratosSortDir === 'asc' ? 1 : -1;

    state.contratosFiltrados.sort((a, b) => {
        if (columna === 'numero') {
            return dir * (a.numero || '').localeCompare(b.numero || '', 'es');
        }
        if (columna === 'contratado') {
            return dir * (a.contratado || '').localeCompare(b.contratado || '', 'es');
        }
        if (columna === 'item_contratado') {
            return dir * (a.item_contratado || '').localeCompare(b.item_contratado || '', 'es');
        }
        if (columna === 'adenda') {
            const aVal = (a.dias_adicionales || 0) > 0 ? 1 : 0;
            const bVal = (b.dias_adicionales || 0) > 0 ? 1 : 0;
            return dir * (bVal - aVal); // asc = SÍ primero
        }
        if (columna === 'monto_total') {
            return dir * ((a.monto_total || 0) - (b.monto_total || 0));
        }
        return 0;
    });

    renderizarContratos({
        contratos: state.contratosFiltrados,
        total: state.contratosFiltrados.length,
        pagina: 1,
        por_pagina: 100
    });
}

function renderizarContratos(data) {
    const container = document.getElementById('lista-documentos');
    const totalEl = document.getElementById('total-docs');

    totalEl.textContent = `${data.total} contrato(s) encontrado(s)`;

    // Actualizar headers de tabla para contratos
    const thead = container.closest('table').querySelector('thead tr');
    thead.innerHTML = `
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NRO</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700" onclick="sortContratos('numero')">CONTRATO ${sortIconContrato('numero')}</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TIPO</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700" onclick="sortContratos('item_contratado')">ITEM CONTRATADO ${sortIconContrato('item_contratado')}</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700" onclick="sortContratos('contratado')">CONTRATADO ${sortIconContrato('contratado')}</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F. INICIO</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F. FIN</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[130px] cursor-pointer select-none hover:text-gray-700" onclick="sortContratos('monto_total')">MONTO ${sortIconContrato('monto_total')}</th>
        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700" onclick="sortContratos('adenda')">ADENDA ${sortIconContrato('adenda')}</th>
        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ESTADO</th>
        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
    `;

    const esAdmin = estaAutenticado();

    if (data.contratos.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="11" class="px-4 py-8 text-center">
                    <div class="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 mx-auto text-gray-400 mb-4">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p class="text-gray-500 mb-4">No hay contratos registrados</p>
                        ${esAdmin ? `
                        <button onclick="mostrarFormularioNuevoContrato()"
                                class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg">
                            Registrar primer contrato
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const offset = (data.pagina - 1) * data.por_pagina;

    container.innerHTML = data.contratos.map((contrato, index) => {
        const tipoLabel = contrato.tipo_contrato === 'equipamiento' ?
            '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Equipamiento</span>' :
            contrato.tipo_contrato === 'mantenimiento' ?
            '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Mantenimiento</span>' : '-';

        // Calcular fechas de inicio y fin
        let fechaInicioStr = '-';
        let fechaFinStr = '-';
        if (contrato.fecha && contrato.plazo_dias) {
            const fechaContrato = new Date(contrato.fecha);
            const fechaInicio = new Date(fechaContrato);
            fechaInicio.setDate(fechaInicio.getDate() + 1);

            const totalDias = contrato.plazo_dias + (contrato.dias_adicionales || 0);
            const fechaFin = new Date(fechaInicio);
            fechaFin.setDate(fechaFin.getDate() + totalDias - 1);

            const formatoFecha = (fecha) => fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            fechaInicioStr = formatoFecha(fechaInicio);
            fechaFinStr = formatoFecha(fechaFin);
        }

        // Generar opciones del select de estado
        const estadoActual = contrato.estado_ejecucion || 'PENDIENTE';
        const estadosOpciones = ['PENDIENTE', 'EN PROCESO', 'EN VALIDACIÓN', 'CONFORME'].map(e =>
            `<option value="${e}" ${e === estadoActual ? 'selected' : ''}>${e}</option>`
        ).join('');

        // Colores según estado
        const colorEstado = {
            'PENDIENTE': 'bg-red-100 text-red-700 border-red-300',
            'EN PROCESO': 'bg-yellow-100 text-yellow-700 border-yellow-300',
            'EN VALIDACIÓN': 'bg-blue-100 text-blue-700 border-blue-300',
            'CONFORME': 'bg-green-100 text-green-700 border-green-300'
        }[estadoActual] || 'bg-gray-100 text-gray-700 border-gray-300';

        return `
        <tr class="documento-row hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900 font-medium cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${offset + index + 1}</td>
            <td class="px-4 py-3 text-sm text-orange-600 font-medium cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${contrato.numero || 'Sin número'}</td>
            <td class="px-4 py-3 text-sm cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${tipoLabel}</td>
            <td class="px-4 py-3 text-sm text-gray-900 cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${contrato.item_contratado || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-900 cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${contrato.contratado || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-600 cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${fechaInicioStr}</td>
            <td class="px-4 py-3 text-sm text-yellow-700 font-semibold cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${fechaFinStr}</td>
            <td class="px-4 py-3 text-sm text-green-700 font-medium text-right whitespace-nowrap min-w-[130px] cursor-pointer" onclick="verDetalleContrato(${contrato.id})">${formatearMonto(contrato.monto_total)}</td>
            <td class="px-4 py-3 text-center cursor-pointer" onclick="verDetalleContrato(${contrato.id})">
                ${(contrato.dias_adicionales || 0) > 0
                    ? '<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">SÍ</span>'
                    : '<span class="text-gray-300 text-xs">—</span>'}
            </td>
            <td class="px-4 py-2 text-center">
                ${esAdmin ? `
                <select onchange="cambiarEstadoContrato(${contrato.id}, this.value); event.stopPropagation();"
                        class="text-xs px-2 py-1 rounded border ${colorEstado} cursor-pointer font-medium">
                    ${estadosOpciones}
                </select>
                ` : `
                <span class="text-xs px-2 py-1 rounded border ${colorEstado} font-medium">${estadoActual}</span>
                `}
            </td>
            ${esAdmin ? `
            <td class="px-4 py-3 text-center">
                <button onclick="confirmarEliminarContrato(${contrato.id}, '${(contrato.numero || '').replace(/'/g, "\\'")}'); event.stopPropagation();"
                        class="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition"
                        title="Eliminar contrato">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </td>
            ` : '<td></td>'}
        </tr>
    `}).join('');

    // Calcular y agregar fila de total
    const totalMonto = data.contratos.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    container.innerHTML += `
        <tr class="bg-gray-100 font-bold border-t-2 border-gray-300">
            <td colspan="8" class="px-4 py-3 text-sm text-right text-gray-700">TOTAL:</td>
            <td class="px-4 py-3 text-sm text-green-700 text-right whitespace-nowrap min-w-[130px]">${formatearMonto(totalMonto)}</td>
            <td colspan="3"></td>
        </tr>
    `;

    renderizarPaginacion(data.total, data.pagina, data.por_pagina);
}

// Cambiar estado de ejecución desde el index
async function cambiarEstadoContrato(id, nuevoEstado) {
    try {
        await apiActualizarContrato(id, { estado_ejecucion: nuevoEstado });

        // Actualizar en el array local
        const contrato = state.contratosOriginales.find(c => c.id === id);
        if (contrato) contrato.estado_ejecucion = nuevoEstado;
        const contratoFiltrado = state.contratosFiltrados.find(c => c.id === id);
        if (contratoFiltrado) contratoFiltrado.estado_ejecucion = nuevoEstado;

        mostrarToast('Estado actualizado');
        aplicarFiltrosContratos(); // Re-renderizar para actualizar colores
    } catch (error) {
        mostrarToast('Error al actualizar estado: ' + error.message, 'error');
    }
}

async function verDetalleContrato(id) {
    try {
        const contrato = await apiObtenerContrato(id);
        state.contratoActual = contrato;
        renderizarDetalleContrato(contrato);
        mostrarVista('vista-detalle-contrato');
    } catch (error) {
        mostrarToast('Error al cargar contrato: ' + error.message, 'error');
    }
}

function renderizarDetalleContrato(contrato) {
    document.getElementById('det-contrato-numero').textContent = contrato.numero || 'Sin número';
    document.getElementById('det-contrato-fecha').textContent = contrato.fecha ? formatearFecha(contrato.fecha) : '-';
    document.getElementById('det-contrato-tipo').textContent = contrato.tipo_contrato ? capitalizar(contrato.tipo_contrato) : '-';
    document.getElementById('det-contrato-contratante').textContent = contrato.contratante || '-';
    document.getElementById('det-contrato-ruc').textContent = contrato.ruc_contratado || '-';
    document.getElementById('det-contrato-contratado').textContent = contrato.contratado || '-';
    document.getElementById('det-contrato-item').textContent = contrato.item_contratado || '-';
    document.getElementById('det-contrato-resumen').textContent = contrato.resumen || 'No hay resumen disponible';

    // Mostrar sección según tipo de contrato
    const detEquipamiento = document.getElementById('det-equipamiento');
    const detMantenimiento = document.getElementById('det-mantenimiento');

    if (contrato.tipo_contrato === 'equipamiento') {
        detEquipamiento.classList.remove('hidden');
        detMantenimiento.classList.add('hidden');
        document.getElementById('det-contrato-cantidad').textContent = contrato.cantidad || '-';
        document.getElementById('det-contrato-precio-unitario').textContent = formatearMonto(contrato.precio_unitario);
        document.getElementById('det-contrato-monto').textContent = formatearMonto(contrato.monto_total);
    } else if (contrato.tipo_contrato === 'mantenimiento') {
        detEquipamiento.classList.add('hidden');
        detMantenimiento.classList.remove('hidden');

        // Renderizar tabla de comisarías
        const tbody = document.getElementById('det-tabla-comisarias');
        if (contrato.comisarias && contrato.comisarias.length > 0) {
            tbody.innerHTML = contrato.comisarias.map(com => `
                <tr>
                    <td class="py-2">${com.nombre_cpnp}</td>
                    <td class="py-2 text-right">${formatearMonto(com.monto)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="2" class="py-2 text-gray-500">Sin comisarías registradas</td></tr>';
        }
        document.getElementById('det-contrato-monto-total').textContent = formatearMonto(contrato.monto_total);
    } else {
        detEquipamiento.classList.add('hidden');
        detMantenimiento.classList.add('hidden');
    }

    // Plazo del contrato
    document.getElementById('det-contrato-plazo').textContent = contrato.plazo_dias ? `${contrato.plazo_dias} días` : '-';
    document.getElementById('det-contrato-dias-adicionales').textContent = contrato.dias_adicionales ? `${contrato.dias_adicionales} días` : '0 días';

    // Calcular fechas de inicio y fin
    if (contrato.fecha && contrato.plazo_dias) {
        const fechaContrato = new Date(contrato.fecha);
        const fechaInicio = new Date(fechaContrato);
        fechaInicio.setDate(fechaInicio.getDate() + 1);

        const totalDias = contrato.plazo_dias + (contrato.dias_adicionales || 0);
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + totalDias - 1);

        const formatoFecha = (fecha) => fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        document.getElementById('det-contrato-fecha-inicio').textContent = formatoFecha(fechaInicio);
        document.getElementById('det-contrato-fecha-fin').textContent = formatoFecha(fechaFin);
    } else {
        document.getElementById('det-contrato-fecha-inicio').textContent = '-';
        document.getElementById('det-contrato-fecha-fin').textContent = '-';
    }

    // Archivo principal
    const archivoContainer = document.getElementById('det-contrato-archivo');
    if (contrato.archivo_local) {
        archivoContainer.innerHTML = `
            <a href="${window.location.origin}/uploads/${contrato.archivo_local}" target="_blank"
               class="link-documento flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
                Ver Contrato ${contrato.numero || ''}
            </a>
        `;
    } else if (contrato.enlace_drive) {
        archivoContainer.innerHTML = `
            <a href="${contrato.enlace_drive}" target="_blank"
               class="link-documento flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Ver en Google Drive
            </a>
        `;
    } else {
        archivoContainer.innerHTML = '<p class="text-gray-500">No hay documento adjunto</p>';
    }

    // Adjuntos
    const adjuntosContainer = document.getElementById('det-contrato-adjuntos');
    if (contrato.adjuntos && contrato.adjuntos.length > 0) {
        adjuntosContainer.innerHTML = contrato.adjuntos.map(adj => `
            <div class="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition">
                <svg class="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                </svg>
                <a href="${adj.archivo_local ? `${window.location.origin}/uploads/${adj.archivo_local}` : adj.enlace_drive}"
                   target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline flex-1">
                    ${adj.nombre || adj.archivo_local || 'Adjunto'}
                </a>
            </div>
        `).join('');
    } else {
        adjuntosContainer.innerHTML = '<p class="text-gray-500 italic">No hay adjuntos</p>';
    }

    // Actualizar visibilidad de botones admin
    actualizarUIAutenticacion();
}

function mostrarFormularioNuevoContrato() {
    limpiarFormularioContrato();
    document.getElementById('form-titulo-contrato').textContent = 'Nuevo Contrato';
    state.editando = false;
    state.archivoTemporalContrato = null;
    state.adjuntosTemporalesContrato = [];
    mostrarVista('vista-formulario-contrato');
}

function limpiarFormularioContrato() {
    document.getElementById('contrato-id').value = '';
    document.getElementById('contrato-numero').value = '';
    document.getElementById('contrato-fecha').value = '';
    document.getElementById('contrato-tipo').value = '';
    document.getElementById('contrato-contratante').value = 'NEMAEC';
    document.getElementById('contrato-ruc').value = '';
    document.getElementById('contrato-contratado').value = '';
    document.getElementById('contrato-item').value = '';
    document.getElementById('contrato-cantidad').value = '';
    document.getElementById('contrato-precio-unitario').value = '';
    document.getElementById('contrato-monto-equipamiento').value = '';
    document.getElementById('contrato-monto').value = '';
    document.getElementById('contrato-num-comisarias').value = '1';
    document.getElementById('contrato-monto-mantenimiento').value = '';
    document.getElementById('contrato-estado-ejecucion').value = 'PENDIENTE';
    document.getElementById('contrato-resumen').value = '';
    document.getElementById('contrato-enlace').value = '';
    document.getElementById('contrato-archivo').value = '';
    document.getElementById('contrato-archivo-status').innerHTML = '';
    document.getElementById('ruc-status').innerHTML = '';
    document.getElementById('contrato-plazo').value = '';
    document.getElementById('contrato-dias-adicionales').value = '0';
    document.getElementById('contrato-fecha-inicio').value = '';
    document.getElementById('contrato-fecha-fin').value = '';
    state.archivoTemporalContrato = null;
    state.adjuntosTemporalesContrato = [];
    document.getElementById('lista-adjuntos-contrato-form').innerHTML = '';

    // Ocultar ambos paneles de tipo
    document.getElementById('campos-equipamiento').classList.add('hidden');
    document.getElementById('campos-mantenimiento').classList.add('hidden');
    document.getElementById('tabla-comisarias').innerHTML = '';
}

// Función para formatear monto con S/ y 2 decimales
function formatearMonto(valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    const num = parseFloat(valor);
    if (isNaN(num)) return '-';
    return 'S/ ' + num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Cambiar tipo de contrato - mostrar/ocultar campos
function cambiarTipoContrato() {
    const tipo = document.getElementById('contrato-tipo').value;
    const camposEquipamiento = document.getElementById('campos-equipamiento');
    const camposMantenimiento = document.getElementById('campos-mantenimiento');

    if (tipo === 'equipamiento') {
        camposEquipamiento.classList.remove('hidden');
        camposMantenimiento.classList.add('hidden');
        // Limpiar campos de mantenimiento
        document.getElementById('tabla-comisarias').innerHTML = '';
        document.getElementById('contrato-monto-mantenimiento').value = '';
    } else if (tipo === 'mantenimiento') {
        camposEquipamiento.classList.add('hidden');
        camposMantenimiento.classList.remove('hidden');
        // Limpiar campos de equipamiento
        document.getElementById('contrato-cantidad').value = '';
        document.getElementById('contrato-precio-unitario').value = '';
        document.getElementById('contrato-monto-equipamiento').value = '';
        // Generar tabla inicial con 1 comisaría
        actualizarTablaComisarias();
    } else {
        camposEquipamiento.classList.add('hidden');
        camposMantenimiento.classList.add('hidden');
    }
}

// Calcular monto total para equipamiento
function calcularMontoEquipamiento() {
    const cantidad = parseFloat(document.getElementById('contrato-cantidad').value) || 0;
    const precioUnitario = parseFloat(document.getElementById('contrato-precio-unitario').value) || 0;
    const montoTotal = cantidad * precioUnitario;

    document.getElementById('contrato-monto-equipamiento').value = formatearMonto(montoTotal);
    document.getElementById('contrato-monto').value = montoTotal;
}

// Actualizar tabla de comisarías según el número seleccionado
function actualizarTablaComisarias() {
    const numComisarias = parseInt(document.getElementById('contrato-num-comisarias').value) || 1;
    const tbody = document.getElementById('tabla-comisarias');

    // Guardar valores actuales
    const valoresActuales = [];
    tbody.querySelectorAll('tr').forEach(row => {
        const nombre = row.querySelector('input[name="cpnp"]')?.value || '';
        const monto = row.querySelector('input[name="monto"]')?.value || '';
        valoresActuales.push({ nombre, monto });
    });

    // Generar nuevas filas
    let html = '';
    for (let i = 0; i < numComisarias; i++) {
        const nombre = valoresActuales[i]?.nombre || '';
        const monto = valoresActuales[i]?.monto || '';
        html += `
            <tr>
                <td class="py-2 pr-2">
                    <input type="text" name="cpnp" placeholder="Ej: CPNP San Martín" value="${nombre}"
                           class="w-full border rounded px-2 py-1 bg-white" required>
                </td>
                <td class="py-2">
                    <input type="number" name="monto" placeholder="0.00" step="0.01" min="0" value="${monto}"
                           onchange="calcularMontoMantenimiento()"
                           class="w-full border rounded px-2 py-1 bg-white text-right" required>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
    calcularMontoMantenimiento();
}

// Calcular monto total para mantenimiento (suma de comisarías)
function calcularMontoMantenimiento() {
    const montos = document.querySelectorAll('#tabla-comisarias input[name="monto"]');
    let total = 0;
    montos.forEach(input => {
        total += parseFloat(input.value) || 0;
    });

    document.getElementById('contrato-monto-mantenimiento').value = formatearMonto(total);
    document.getElementById('contrato-monto').value = total;
}

// Calcular fecha fin de contrato
function calcularFechaFin() {
    const fechaInput = document.getElementById('contrato-fecha').value;
    const plazoDias = parseInt(document.getElementById('contrato-plazo').value) || 0;
    const diasAdicionales = parseInt(document.getElementById('contrato-dias-adicionales').value) || 0;

    const fechaInicioEl = document.getElementById('contrato-fecha-inicio');
    const fechaFinEl = document.getElementById('contrato-fecha-fin');

    if (!fechaInput || plazoDias <= 0) {
        fechaInicioEl.value = '';
        fechaFinEl.value = '';
        return;
    }

    // Fecha inicio = fecha contrato + 1 día
    const fechaContrato = new Date(fechaInput + 'T00:00:00');
    const fechaInicio = new Date(fechaContrato);
    fechaInicio.setDate(fechaInicio.getDate() + 1);

    // Fecha fin = fecha inicio + plazo días + días adicionales - 1 (porque el día de inicio cuenta)
    const totalDias = plazoDias + diasAdicionales;
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + totalDias - 1);

    // Formatear fechas para mostrar
    const formatoFecha = (fecha) => {
        return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    fechaInicioEl.value = formatoFecha(fechaInicio);
    fechaFinEl.value = formatoFecha(fechaFin);
}

async function buscarRUC() {
    const rucInput = document.getElementById('contrato-ruc');
    const contratadoInput = document.getElementById('contrato-contratado');
    const statusEl = document.getElementById('ruc-status');
    const btn = document.getElementById('btn-buscar-ruc');

    const ruc = rucInput.value.trim();

    // Validar RUC
    if (!ruc) {
        mostrarToast('Ingrese un RUC para buscar', 'error');
        return;
    }

    if (!/^\d{11}$/.test(ruc)) {
        mostrarToast('El RUC debe tener 11 dígitos', 'error');
        return;
    }

    // Mostrar estado de carga
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin">⏳</span>';
    statusEl.innerHTML = '<span class="text-blue-600">Consultando SUNAT...</span>';

    try {
        const resultado = await apiConsultarRUC(ruc);

        if (resultado.exito) {
            contratadoInput.value = resultado.razon_social;
            statusEl.innerHTML = `<span class="text-green-600">✓ ${resultado.estado} - ${resultado.condicion}</span>`;
            mostrarToast('Razón social encontrada');
        } else {
            statusEl.innerHTML = `<span class="text-red-600">✗ ${resultado.mensaje}</span>`;
            mostrarToast(resultado.mensaje, 'error');
        }
    } catch (error) {
        statusEl.innerHTML = `<span class="text-red-600">✗ Error al consultar</span>`;
        mostrarToast('Error: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>`;
    }
}

function editarContrato() {
    const contrato = state.contratoActual;
    if (!contrato) return;

    document.getElementById('form-titulo-contrato').textContent = 'Editar Contrato';
    document.getElementById('contrato-id').value = contrato.id;
    document.getElementById('contrato-numero').value = contrato.numero || '';
    document.getElementById('contrato-fecha').value = contrato.fecha ? contrato.fecha.split('T')[0] : '';
    document.getElementById('contrato-tipo').value = contrato.tipo_contrato || '';
    document.getElementById('contrato-contratante').value = contrato.contratante || '';
    document.getElementById('contrato-ruc').value = contrato.ruc_contratado || '';
    document.getElementById('contrato-contratado').value = contrato.contratado || '';
    document.getElementById('contrato-item').value = contrato.item_contratado || '';
    document.getElementById('contrato-monto').value = contrato.monto_total || '';
    document.getElementById('contrato-estado-ejecucion').value = contrato.estado_ejecucion || 'PENDIENTE';
    document.getElementById('contrato-resumen').value = contrato.resumen || '';
    document.getElementById('contrato-enlace').value = contrato.enlace_drive || '';

    // Mostrar campos según tipo de contrato
    cambiarTipoContrato();

    if (contrato.tipo_contrato === 'equipamiento') {
        document.getElementById('contrato-cantidad').value = contrato.cantidad || '';
        document.getElementById('contrato-precio-unitario').value = contrato.precio_unitario || '';
        calcularMontoEquipamiento();
    } else if (contrato.tipo_contrato === 'mantenimiento') {
        // Cargar comisarías
        const numComisarias = contrato.comisarias?.length || 1;
        document.getElementById('contrato-num-comisarias').value = numComisarias;
        actualizarTablaComisarias();

        // Llenar valores de comisarías
        if (contrato.comisarias && contrato.comisarias.length > 0) {
            const rows = document.querySelectorAll('#tabla-comisarias tr');
            contrato.comisarias.forEach((com, i) => {
                if (rows[i]) {
                    rows[i].querySelector('input[name="cpnp"]').value = com.nombre_cpnp;
                    rows[i].querySelector('input[name="monto"]').value = com.monto;
                }
            });
            calcularMontoMantenimiento();
        }
    }

    // Cargar campos de plazo
    document.getElementById('contrato-plazo').value = contrato.plazo_dias || '';
    document.getElementById('contrato-dias-adicionales').value = contrato.dias_adicionales || 0;
    calcularFechaFin();

    if (contrato.archivo_local) {
        document.getElementById('contrato-archivo-status').innerHTML = `Archivo actual: <a href="${window.location.origin}/uploads/${contrato.archivo_local}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${contrato.archivo_local}</a>`;
    }

    state.editando = true;
    state.adjuntosTemporalesContrato = [];
    renderizarAdjuntosContratoForm();
    mostrarVista('vista-formulario-contrato');
}

async function guardarContrato(event) {
    event.preventDefault();

    const contratoId = document.getElementById('contrato-id').value;
    const tipoContrato = document.getElementById('contrato-tipo').value;

    const contrato = {
        numero: document.getElementById('contrato-numero').value || null,
        fecha: document.getElementById('contrato-fecha').value || null,
        tipo_contrato: tipoContrato || null,
        contratante: document.getElementById('contrato-contratante').value || null,
        ruc_contratado: document.getElementById('contrato-ruc').value || null,
        contratado: document.getElementById('contrato-contratado').value || null,
        item_contratado: document.getElementById('contrato-item').value || null,
        plazo_dias: document.getElementById('contrato-plazo').value ? parseInt(document.getElementById('contrato-plazo').value) : null,
        dias_adicionales: document.getElementById('contrato-dias-adicionales').value ? parseInt(document.getElementById('contrato-dias-adicionales').value) : 0,
        estado_ejecucion: document.getElementById('contrato-estado-ejecucion').value || 'PENDIENTE',
        resumen: document.getElementById('contrato-resumen').value || null,
        enlace_drive: document.getElementById('contrato-enlace').value || null
    };

    // Campos según tipo de contrato
    if (tipoContrato === 'equipamiento') {
        contrato.cantidad = document.getElementById('contrato-cantidad').value ? parseInt(document.getElementById('contrato-cantidad').value) : null;
        contrato.precio_unitario = document.getElementById('contrato-precio-unitario').value ? parseFloat(document.getElementById('contrato-precio-unitario').value) : null;
        contrato.monto_total = document.getElementById('contrato-monto').value ? parseFloat(document.getElementById('contrato-monto').value) : null;
    } else if (tipoContrato === 'mantenimiento') {
        // Obtener comisarías de la tabla
        const comisarias = [];
        document.querySelectorAll('#tabla-comisarias tr').forEach(row => {
            const nombre = row.querySelector('input[name="cpnp"]')?.value;
            const monto = row.querySelector('input[name="monto"]')?.value;
            if (nombre && monto) {
                comisarias.push({
                    nombre_cpnp: nombre,
                    monto: parseFloat(monto)
                });
            }
        });
        contrato.comisarias = comisarias;
        contrato.monto_total = document.getElementById('contrato-monto').value ? parseFloat(document.getElementById('contrato-monto').value) : null;
    }

    try {
        // Auto-subir archivo si hay uno seleccionado en el input (sin necesidad de clicar "Subir")
        const archivoInput = document.getElementById('contrato-archivo');
        if (archivoInput.files[0]) {
            const statusEl = document.getElementById('contrato-archivo-status');
            statusEl.textContent = 'Subiendo archivo...';
            const resultadoArchivo = await apiSubirArchivoTemporal(archivoInput.files[0]);
            state.archivoTemporalContrato = resultadoArchivo.archivo;
            statusEl.textContent = 'Archivo listo';
        }

        let resultado;

        if (contratoId) {
            resultado = await apiActualizarContrato(contratoId, contrato);

            if (state.archivoTemporalContrato) {
                await apiAsociarArchivoContrato(contratoId, state.archivoTemporalContrato);
            }

            if (state.adjuntosTemporalesContrato.length > 0) {
                await subirAdjuntosTemporalesContrato(contratoId);
            }

            mostrarToast('Contrato actualizado correctamente');
        } else {
            resultado = await apiCrearContrato(contrato);

            if (state.archivoTemporalContrato) {
                await apiAsociarArchivoContrato(resultado.id, state.archivoTemporalContrato);
            }

            if (state.adjuntosTemporalesContrato.length > 0) {
                await subirAdjuntosTemporalesContrato(resultado.id);
            }

            mostrarToast('Contrato creado correctamente');
        }

        mostrarVista('vista-bandeja');
        state.contratoActual = null;
        state.archivoTemporalContrato = null;
        state.editando = false;
        state.adjuntosTemporalesContrato = [];
        filtrarPorCategoria('contratos');
    } catch (error) {
        mostrarToast('Error: ' + error.message, 'error');
    }
}

async function subirArchivoContrato() {
    const archivo = document.getElementById('contrato-archivo').files[0];
    if (!archivo) {
        mostrarToast('Seleccione un archivo PDF', 'error');
        return;
    }

    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
        mostrarToast('Solo se permiten archivos PDF', 'error');
        return;
    }

    const statusEl = document.getElementById('contrato-archivo-status');
    statusEl.textContent = 'Subiendo archivo...';

    try {
        const resultado = await apiSubirArchivoTemporal(archivo);
        state.archivoTemporalContrato = resultado.archivo;
        statusEl.innerHTML = `Archivo subido: <a href="${window.location.origin}/uploads/${resultado.archivo}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${resultado.archivo}</a>`;
        mostrarToast('Archivo subido correctamente');
    } catch (error) {
        statusEl.innerHTML = '<span class="text-red-600">Error al subir archivo</span>';
        mostrarToast('Error: ' + error.message, 'error');
    }
}

async function eliminarContratoDetalle() {
    if (!state.contratoActual) return;

    if (!confirm('¿Está seguro de eliminar este contrato?')) return;

    try {
        await apiEliminarContrato(state.contratoActual.id);
        mostrarToast('Contrato eliminado');
        mostrarBandeja();
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
}

async function confirmarEliminarContrato(id, numero) {
    const mensaje = numero
        ? `¿Está seguro de querer borrar el contrato ${numero}?`
        : '¿Está seguro de querer borrar este contrato?';

    if (!confirm(mensaje)) return;

    try {
        await apiEliminarContrato(id);
        mostrarToast('Contrato eliminado correctamente');
        cargarContratos();
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
}

// --- Adjuntos de contrato ---

function agregarAdjuntosContrato() {
    const inputAdjunto = document.getElementById('nuevo-adjunto-contrato');
    const archivos = inputAdjunto.files;

    if (!archivos || archivos.length === 0) {
        mostrarToast('Seleccione al menos un archivo para adjuntar', 'error');
        return;
    }

    let agregados = 0;
    let duplicados = 0;

    for (const archivo of archivos) {
        const yaExiste = state.adjuntosTemporalesContrato.some(adj => adj.name === archivo.name);
        if (yaExiste) {
            duplicados++;
            continue;
        }
        state.adjuntosTemporalesContrato.push(archivo);
        agregados++;
    }

    renderizarAdjuntosContratoForm();
    inputAdjunto.value = '';

    if (agregados > 0 && duplicados === 0) {
        mostrarToast(`${agregados} adjunto${agregados > 1 ? 's' : ''} agregado${agregados > 1 ? 's' : ''}`);
    } else if (agregados > 0 && duplicados > 0) {
        mostrarToast(`${agregados} agregado${agregados > 1 ? 's' : ''}, ${duplicados} duplicado${duplicados > 1 ? 's' : ''} omitido${duplicados > 1 ? 's' : ''}`);
    } else if (duplicados > 0) {
        mostrarToast('Los archivos ya están en la lista', 'error');
    }
}

function removerAdjuntoContrato(index) {
    state.adjuntosTemporalesContrato.splice(index, 1);
    renderizarAdjuntosContratoForm();
}

async function removerAdjuntoContratoExistente(adjuntoId) {
    const confirmacion = await Swal.fire({
        title: '¿Eliminar adjunto?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        try {
            await apiEliminarAdjuntoContrato(adjuntoId);
            mostrarToast('Adjunto eliminado');
            if (state.contratoActual) {
                const contratoActualizado = await apiObtenerContrato(state.contratoActual.id);
                state.contratoActual = contratoActualizado;
                renderizarAdjuntosContratoForm();
            }
        } catch (error) {
            mostrarToast('Error al eliminar adjunto: ' + error.message, 'error');
        }
    }
}

function renderizarAdjuntosContratoForm() {
    const container = document.getElementById('lista-adjuntos-contrato-form');

    let htmlExistentes = '';
    if (state.contratoActual && state.contratoActual.adjuntos && state.contratoActual.adjuntos.length > 0) {
        htmlExistentes = '<div class="mb-3"><p class="text-sm font-medium text-gray-600 mb-2">Adjuntos guardados:</p>';
        htmlExistentes += state.contratoActual.adjuntos.map(adj => `
            <div class="flex items-center justify-between bg-white p-2 rounded border mb-1">
                <a href="${adj.archivo_local ? `${window.location.origin}/uploads/${adj.archivo_local}` : adj.enlace_drive}"
                   target="_blank" class="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    ${adj.nombre || adj.archivo_local || 'Adjunto'}
                </a>
                <button type="button" onclick="removerAdjuntoContratoExistente(${adj.id})"
                        class="text-red-500 hover:text-red-700 p-1" title="Eliminar adjunto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
        htmlExistentes += '</div>';
    }

    let htmlTemporales = '';
    if (state.adjuntosTemporalesContrato.length > 0) {
        htmlTemporales = '<div><p class="text-sm font-medium text-gray-600 mb-2">Nuevos adjuntos por guardar:</p>';
        htmlTemporales += state.adjuntosTemporalesContrato.map((archivo, index) => `
            <div class="flex items-center justify-between bg-orange-100 p-2 rounded border border-orange-300 mb-1">
                <span class="text-sm text-gray-700 flex items-center gap-2">
                    <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    ${archivo.name}
                </span>
                <button type="button" onclick="removerAdjuntoContrato(${index})"
                        class="text-red-500 hover:text-red-700 p-1" title="Quitar adjunto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
        htmlTemporales += '</div>';
    }

    container.innerHTML = htmlExistentes + htmlTemporales;
}

async function subirAdjuntosTemporalesContrato(contratoId) {
    for (const archivo of state.adjuntosTemporalesContrato) {
        try {
            await apiAgregarAdjuntoContrato(contratoId, archivo, null, archivo.name);
        } catch (error) {
            console.error('Error al subir adjunto de contrato:', archivo.name, error);
        }
    }
    state.adjuntosTemporalesContrato = [];
}

// ============================================
// FIN CONTRATOS
// ============================================

// Debounce para búsqueda
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
