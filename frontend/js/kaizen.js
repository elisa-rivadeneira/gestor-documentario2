/* ================================================================
   KAIZEN — Registro de Mejora NEMAEC
   Formulario progresivo con asistencia IA guiada
   ================================================================ */

const PUESTOS_KAIZEN = [
    'PRESIDENTE NEMAEC',
    'SECRETARIO',
    'COORDINADOR GENERAL',
    'ADMINISTRADOR',
    'ASISTENTE ADMINISTRATIVO',
    'ASISTENTE DE EQUIPAMIENTO',
    'COORDINADOR DE EQUIPAMIENTO',
    'MONITOR DE OBRA',
    'ESPECIALISTA TIC',
    'TESORERO',
];

const BLOQUES = ['problema','impacto','causa','solucion','aprendizaje','clasificacion'];
const BLOQUE_TITULOS = [
    '① Problema', '② Impacto', '③ Causa Raíz — 5 Porqués',
    '④ Solución', '⑤ Aprendizaje', '⑥ Clasificación'
];

let kz = {
    id: null,
    bloqueActual: 0,
    guardando: false,
    autoSaveTimer: null,
    data: {
        proyecto_comisaria: '',
        problema: '',
        impacto_descripcion: '',
        impacto_tipos: [],
        porques: [''],
        solucion: '',
        solucion_responsable: '',
        solucion_momento: '',
        aprendizaje: '',
        clasificacion_tipo: '',
        clasificacion_impacto: '',
    }
};

// ── Entrada al módulo ──────────────────────────────────────────
function mostrarKaizen() {
    actualizarBotonesMenu('kaizen');
    mostrarVista('vista-kaizen');
    kzReset();
    kzRenderHeader();
    kzRenderBloque(0);
}

function kzReset() {
    kz.id = null;
    kz.bloqueActual = 0;
    kz.guardando = false;
    kz.data = {
        proyecto_comisaria: '',
        problema: '',
        impacto_descripcion: '',
        impacto_tipos: [],
        porques: [''],
        solucion: '',
        solucion_responsable: '',
        solucion_momento: '',
        aprendizaje: '',
        clasificacion_tipo: '',
        clasificacion_impacto: '',
    };
}

// ── Header del formulario ──────────────────────────────────────
function kzRenderHeader() {
    const hoy = new Date().toLocaleDateString('es-PE', { dateStyle: 'long' });
    const usuario = document.getElementById('usuario-nombre')?.textContent?.trim() || 'Usuario';
    document.getElementById('kz-fecha').textContent = hoy;
    document.getElementById('kz-usuario').textContent = usuario;

    const sel = document.getElementById('kz-comisaria');
    sel.innerHTML = '<option value="">— Seleccionar puesto de trabajo —</option>'
        + PUESTOS_KAIZEN.map(p => `<option value="${p}">${p}</option>`).join('');
    sel.value = kz.data.proyecto_comisaria;
    sel.addEventListener('change', () => kzActualizarPlaceholders(sel.value));
    kzActualizarPlaceholders(sel.value);
}

const KZ_EJEMPLOS = {
    'PRESIDENTE NEMAEC': {
        problema:    'Ej: En la reunión de coordinación con UGPE, no se presentó el informe de avance mensual porque no estaba consolidado a tiempo, generando una observación formal.',
        impacto:     'Ej: Se postergó la aprobación del siguiente desembolso por falta de sustento documentario ante FONCODES.',
        solucion:    'Ej: Se estableció un cronograma interno de cierre de informes 5 días antes de cada reunión con UGPE.',
        aprendizaje: 'Ej: La presidencia debe contar con un tablero consolidado de avance antes de cada reunión interinstitucional.',
    },
    'SECRETARIO': {
        problema:    'Ej: Un oficio de UGPE llegó con 3 días de retraso al área destino porque no se registró en el sistema al ingreso.',
        impacto:     'Ej: Se venció el plazo de respuesta solicitado, generando una llamada de atención formal.',
        solucion:    'Ej: Se implementó el registro obligatorio de toda correspondencia entrante el mismo día de recepción.',
        aprendizaje: 'Ej: Todo documento recibido debe ser registrado y derivado dentro de las 2 horas de ingreso.',
    },
    'COORDINADOR GENERAL': {
        problema:    'Ej: Dos áreas ejecutaron acciones en paralelo sobre el mismo contrato sin coordinarse, generando información contradictoria ante el supervisor.',
        impacto:     'Ej: Se generó confusión en el expediente técnico y fue necesario corregir 4 documentos ya firmados.',
        solucion:    'Ej: Se definió que toda acción sobre contratos activos debe ser coordinada previamente en reunión semanal de equipo.',
        aprendizaje: 'Ej: Antes de emitir cualquier comunicación sobre un contrato, verificar con el área técnica el estado actualizado.',
    },
    'ADMINISTRADOR': {
        problema:    'Ej: Se detectó que un expediente de pago fue devuelto por UGPE porque faltaba la firma del supervisor de campo.',
        impacto:     'Ej: El pago al contratista se retrasó 8 días hábiles, generando una carta de reclamo.',
        solucion:    'Ej: Se creó un checklist de requisitos mínimos antes de remitir cualquier expediente de pago.',
        aprendizaje: 'Ej: Todo expediente debe pasar por revisión de checklist antes de ser firmado por el administrador.',
    },
    'ASISTENTE ADMINISTRATIVO': {
        problema:    'Ej: Se archivaron contratos sin foliar, lo que dificultó la ubicación de un addendum requerido en una auditoría.',
        impacto:     'Ej: Se perdieron 2 horas de trabajo buscando documentos y se generó una observación en el informe de auditoría.',
        solucion:    'Ej: Se estableció el foliado y etiquetado de todos los expedientes al momento de su cierre.',
        aprendizaje: 'Ej: Todo expediente cerrado debe ser foliado, etiquetado y registrado en el índice documental el mismo día.',
    },
    'ASISTENTE DE EQUIPAMIENTO': {
        problema:    'Ej: Se recepcionaron 5 laptops sin verificar los números de serie contra la orden de compra, detectándose una discrepancia 2 semanas después.',
        impacto:     'Ej: Hubo que levantar un acta de observación tardía y se retrasó la entrega final a la comisaría.',
        solucion:    'Ej: Se incorporó la verificación de números de serie como paso obligatorio en el acta de recepción.',
        aprendizaje: 'Ej: Nunca firmar acta de recepción sin verificar cada ítem contra la orden de compra y especificaciones técnicas.',
    },
    'COORDINADOR DE EQUIPAMIENTO': {
        problema:    'Ej: 3 de 10 escritorios recepcionados en la comisaría San Cayetano llegaron con daños en el tablero, impidiendo su instalación.',
        impacto:     'Ej: Se retrasó la entrega en 5 días hábiles y se generó una observación formal al proveedor.',
        solucion:    'Ej: Se coordinó el reemplazo con el proveedor y se actualizó el protocolo de recepción con verificación fotográfica.',
        aprendizaje: 'Ej: Toda recepción de mobiliario debe incluir inspección visual y registro fotográfico antes de firmar el acta.',
    },
    'MONITOR DE OBRA': {
        problema:    'Ej: El contratista no ejecutó la partida de pintura en el plazo previsto porque no contaba con el material aprobado en obra.',
        impacto:     'Ej: Se generó un retraso de 6 días en el cronograma de ejecución y se afectó la fecha de entrega.',
        solucion:    'Ej: Se emitió una anotación en el cuaderno de obra exigiendo el plan de abastecimiento de materiales con 5 días de anticipación.',
        aprendizaje: 'Ej: Verificar el stock de materiales críticos cada semana en las visitas de supervisión de campo.',
    },
    'ESPECIALISTA TIC': {
        problema:    'Ej: El sistema de gestión documental estuvo inaccesible 4 horas por una actualización no coordinada del servidor, bloqueando el registro de documentos.',
        impacto:     'Ej: 6 usuarios no pudieron registrar correspondencia urgente y se generaron retrasos en los plazos de respuesta.',
        solucion:    'Ej: Se estableció un protocolo de ventana de mantenimiento los viernes de 6pm a 8pm con aviso previo de 48h.',
        aprendizaje: 'Ej: Toda intervención en servidores de producción debe tener un plan de rollback aprobado antes de ejecutarse.',
    },
    'TESORERO': {
        problema:    'Ej: Un pago a proveedor fue procesado con el número de cuenta incorrecto porque se usó un formato desactualizado.',
        impacto:     'Ej: El pago tuvo que ser reversado, generando un retraso de 3 días hábiles y una comisión bancaria adicional.',
        solucion:    'Ej: Se estableció la verificación obligatoria de cuentas bancarias directamente en el sistema del banco antes de cada transferencia.',
        aprendizaje: 'Ej: Antes de procesar cualquier pago, confirmar los datos bancarios del proveedor con la documentación vigente del contrato.',
    },
};

function kzActualizarPlaceholders(puesto) {
    const ej = KZ_EJEMPLOS[puesto] || {
        problema:    'Ej: Describe qué ocurrió, cuándo y cómo afectó el trabajo.',
        impacto:     'Ej: Indica el impacto concreto: días de retraso, costo, proceso bloqueado.',
        solucion:    'Ej: Describe la acción concreta tomada para resolver la causa raíz.',
        aprendizaje: 'Ej: Formula una regla: "Siempre verificar X antes de Y para evitar Z."',
    };
    const setPlaceholder = (id, txt) => { const el = document.getElementById(id); if (el) el.placeholder = txt; };
    setPlaceholder('kz-problema',    ej.problema);
    setPlaceholder('kz-impacto',     ej.impacto);
    setPlaceholder('kz-solucion',    ej.solucion);
    setPlaceholder('kz-aprendizaje', ej.aprendizaje);
}

// ── Progress bar ───────────────────────────────────────────────
function kzRenderProgress() {
    for (let i = 0; i < 6; i++) {
        const dot = document.getElementById(`kz-step-${i}`);
        if (!dot) continue;
        dot.className = 'kz-step-dot';
        if (i < kz.bloqueActual)      dot.classList.add('kz-step-done');
        else if (i === kz.bloqueActual) dot.classList.add('kz-step-active');
    }
    document.getElementById('kz-progress-bar').style.width =
        (kz.bloqueActual / 5 * 100) + '%';
}

// ── Renderizar bloque actual ───────────────────────────────────
function kzRenderBloque(n) {
    kz.bloqueActual = n;
    kzRenderProgress();

    document.querySelectorAll('.kz-bloque').forEach((el, i) => {
        el.classList.toggle('kz-bloque-active', i === n);
        el.classList.toggle('kz-bloque-done', i < n);
        el.classList.toggle('kz-bloque-hidden', i > n);
    });

    kzLimpiarIA();

    // Rellenar campos con datos guardados
    if (n === 0) kzRellenarProblema();
    if (n === 1) kzRellenarImpacto();
    if (n === 2) kzRenderPorques();
    if (n === 3) kzRellenarSolucion();
    if (n === 4) kzRellenarAprendizaje();
    if (n === 5) kzRellenarClasificacion();
}

// ── Bloque 0: Problema ─────────────────────────────────────────
function kzRellenarProblema() {
    document.getElementById('kz-problema').value = kz.data.problema;
}

// ── Bloque 1: Impacto ──────────────────────────────────────────
function kzRellenarImpacto() {
    document.getElementById('kz-impacto').value = kz.data.impacto_descripcion;
    document.querySelectorAll('.kz-impacto-check').forEach(cb => {
        cb.checked = kz.data.impacto_tipos.includes(cb.value);
    });
}

// ── Bloque 2: 5 Porqués ────────────────────────────────────────
function kzRenderPorques() {
    const wrap = document.getElementById('kz-porques-wrap');
    wrap.innerHTML = '';
    kz.data.porques.forEach((txt, i) => {
        const pregunta = i === 0
            ? '¿Por qué ocurrió el problema?'
            : `¿Por qué ocurrió eso? <span class="kz-nivel">(Nivel ${i + 1})</span>`;
        wrap.innerHTML += `
        <div class="kz-porque-item" id="kz-porque-item-${i}">
            <div class="kz-porque-label">${pregunta}</div>
            <div class="kz-porque-row">
                <textarea id="kz-porque-${i}" rows="2" class="kz-textarea kz-porque-ta"
                    placeholder="Describe la causa..."
                    oninput="kz.data.porques[${i}]=this.value;kzAutoGuardar()"
                    onfocus="kzLimpiarIA()">${txt}</textarea>
                ${i > 0 ? `<button class="kz-remove-porque" onclick="kzEliminarPorque(${i})" title="Eliminar nivel">✕</button>` : ''}
            </div>
            <button class="kz-btn-ia kz-btn-sm" onclick="kzAsistir('causa','preguntar',kz.data.porques[${i}])">
                🤖 Siguiente nivel
            </button>
        </div>`;
    });

    if (kz.data.porques.length < 5) {
        wrap.innerHTML += `
        <button class="kz-btn-add-porque" onclick="kzAgregarPorque()">
            + Agregar nivel de causa
        </button>`;
    }
}

function kzAgregarPorque() {
    if (kz.data.porques.length >= 5) return;
    kz.data.porques.push('');
    kzRenderPorques();
    setTimeout(() => {
        const last = document.getElementById(`kz-porque-${kz.data.porques.length - 1}`);
        if (last) last.focus();
    }, 50);
}

function kzEliminarPorque(i) {
    kz.data.porques.splice(i, 1);
    kzRenderPorques();
}

// ── Bloque 3: Solución ─────────────────────────────────────────
function kzRellenarSolucion() {
    document.getElementById('kz-solucion').value = kz.data.solucion;
    document.getElementById('kz-responsable').value = kz.data.solucion_responsable;
    document.querySelectorAll('.kz-momento-btn').forEach(btn => {
        btn.classList.toggle('kz-momento-active', btn.dataset.v === kz.data.solucion_momento);
    });
}

function kzSeleccionarMomento(v) {
    kz.data.solucion_momento = v;
    document.querySelectorAll('.kz-momento-btn').forEach(btn => {
        btn.classList.toggle('kz-momento-active', btn.dataset.v === v);
    });
    kzAutoGuardar();
}

// ── Bloque 4: Aprendizaje ──────────────────────────────────────
function kzRellenarAprendizaje() {
    document.getElementById('kz-aprendizaje').value = kz.data.aprendizaje;
}

// ── Bloque 5: Clasificación ────────────────────────────────────
function kzRellenarClasificacion() {
    document.querySelectorAll('.kz-tipo-btn').forEach(btn => {
        btn.classList.toggle('kz-tipo-active', btn.dataset.v === kz.data.clasificacion_tipo);
    });
    document.querySelectorAll('.kz-nivel-impacto-btn').forEach(btn => {
        btn.classList.toggle('kz-nivel-active', btn.dataset.v === kz.data.clasificacion_impacto);
    });
}

function kzSeleccionarTipo(v) {
    kz.data.clasificacion_tipo = v;
    document.querySelectorAll('.kz-tipo-btn').forEach(b =>
        b.classList.toggle('kz-tipo-active', b.dataset.v === v));
}

function kzSeleccionarNivelImpacto(v) {
    kz.data.clasificacion_impacto = v;
    document.querySelectorAll('.kz-nivel-impacto-btn').forEach(b =>
        b.classList.toggle('kz-nivel-active', b.dataset.v === v));
}

// ── Validación antes de avanzar ────────────────────────────────
function kzValidarBloque(n) {
    const err = id => { kzMostrarError(id); return false; };

    if (n === 0) {
        const v = document.getElementById('kz-problema').value.trim();
        kz.data.problema = v;
        if (v.length < 20)
            return err('kz-error-problema');
        if (v.split(' ').length < 5)
            return err('kz-error-problema');
    }
    if (n === 1) {
        const v = document.getElementById('kz-impacto').value.trim();
        kz.data.impacto_descripcion = v;
        kz.data.impacto_tipos = [...document.querySelectorAll('.kz-impacto-check:checked')].map(c => c.value);
        if (v.length < 10)
            return err('kz-error-impacto');
    }
    if (n === 2) {
        const primero = (kz.data.porques[0] || '').trim();
        if (primero.length < 10)
            return err('kz-error-causa');
    }
    if (n === 3) {
        const v = document.getElementById('kz-solucion').value.trim();
        kz.data.solucion = v;
        kz.data.solucion_responsable = document.getElementById('kz-responsable').value.trim();
        if (v.length < 10)
            return err('kz-error-solucion');
        if (!kz.data.solucion_responsable)
            return err('kz-error-responsable');
        if (!kz.data.solucion_momento)
            return err('kz-error-momento');
    }
    if (n === 4) {
        const v = document.getElementById('kz-aprendizaje').value.trim();
        kz.data.aprendizaje = v;
        if (v.length < 10)
            return err('kz-error-aprendizaje');
    }
    return true;
}

function kzMostrarError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => el.classList.add('hidden'), 4000);
}

function kzOcultarErrores() {
    document.querySelectorAll('.kz-error').forEach(e => e.classList.add('hidden'));
}

// ── Navegación entre bloques ───────────────────────────────────
function kzSiguiente() {
    kzOcultarErrores();
    if (!kzValidarBloque(kz.bloqueActual)) return;
    kzGuardarLocal();
    if (kz.bloqueActual < 5) {
        kzRenderBloque(kz.bloqueActual + 1);
        document.getElementById('vista-kaizen').scrollTop = 0;
    }
}

function kzAnterior() {
    kzGuardarLocal();
    if (kz.bloqueActual > 0)
        kzRenderBloque(kz.bloqueActual - 1);
}

// ── Persistir datos de campos al avanzar ───────────────────────
function kzGuardarLocal() {
    if (kz.bloqueActual === 0)
        kz.data.problema = document.getElementById('kz-problema')?.value || '';
    if (kz.bloqueActual === 1) {
        kz.data.impacto_descripcion = document.getElementById('kz-impacto')?.value || '';
        kz.data.impacto_tipos = [...document.querySelectorAll('.kz-impacto-check:checked')].map(c => c.value);
    }
    if (kz.bloqueActual === 3) {
        kz.data.solucion = document.getElementById('kz-solucion')?.value || '';
        kz.data.solucion_responsable = document.getElementById('kz-responsable')?.value || '';
    }
    if (kz.bloqueActual === 4)
        kz.data.aprendizaje = document.getElementById('kz-aprendizaje')?.value || '';
}

// ── Auto-guardado en BD (draft) ────────────────────────────────
function kzAutoGuardar() {
    clearTimeout(kz.autoSaveTimer);
    kz.autoSaveTimer = setTimeout(kzGuardarDraft, 1800);
}

async function kzGuardarDraft() {
    if (!estaAutenticado()) return;
    kzGuardarLocal();
    const payload = kzArmarPayload();
    try {
        if (!kz.id) {
            const res = await fetch('/api/mejoras', {
                method: 'POST',
                headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + getToken() },
                body: JSON.stringify(payload)
            });
            if (res.ok) { const d = await res.json(); kz.id = d.id; }
        } else {
            await fetch(`/api/mejoras/${kz.id}`, {
                method: 'PUT',
                headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + getToken() },
                body: JSON.stringify(payload)
            });
        }
        kzMostrarIndicadorGuardado();
    } catch {}
}

function kzArmarPayload() {
    return {
        proyecto_comisaria: document.getElementById('kz-comisaria')?.value || kz.data.proyecto_comisaria,
        problema: kz.data.problema,
        impacto_descripcion: kz.data.impacto_descripcion,
        impacto_tipos: JSON.stringify(kz.data.impacto_tipos),
        porques: JSON.stringify(kz.data.porques),
        solucion: kz.data.solucion,
        solucion_responsable: kz.data.solucion_responsable,
        solucion_momento: kz.data.solucion_momento,
        aprendizaje: kz.data.aprendizaje,
        clasificacion_tipo: kz.data.clasificacion_tipo,
        clasificacion_impacto: kz.data.clasificacion_impacto,
    };
}

function kzMostrarIndicadorGuardado() {
    const ind = document.getElementById('kz-guardado-ind');
    if (!ind) return;
    ind.classList.remove('hidden');
    setTimeout(() => ind.classList.add('hidden'), 2000);
}

// ── Envío final ────────────────────────────────────────────────
async function kzEnviar() {
    kzOcultarErrores();
    if (!kz.data.clasificacion_tipo) { kzMostrarError('kz-error-tipo'); return; }
    if (!kz.data.clasificacion_impacto) { kzMostrarError('kz-error-nivel'); return; }

    const btn = document.getElementById('kz-btn-enviar');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    await kzGuardarDraft();
    if (!kz.id) { btn.disabled = false; btn.textContent = 'Enviar registro'; mostrarToast('Error al guardar', 'error'); return; }

    try {
        const res = await fetch(`/api/mejoras/${kz.id}/enviar`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        if (!res.ok) throw new Error();
        kzMostrarExito();
    } catch {
        mostrarToast('Error al enviar el registro', 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar registro';
    }
}

function kzMostrarExito() {
    document.getElementById('kz-form-wrap').classList.add('hidden');
    document.getElementById('kz-exito').classList.remove('hidden');
}

function kzNuevoRegistro() {
    document.getElementById('kz-exito').classList.add('hidden');
    document.getElementById('kz-form-wrap').classList.remove('hidden');
    kzReset();
    kzRenderHeader();
    kzRenderBloque(0);
}

// ── Chat IA ────────────────────────────────────────────────────
const KZ_CAMPOS_BLOQUE = ['kz-problema', 'kz-impacto', null, 'kz-solucion', 'kz-aprendizaje', null];

let kzChat = { bloque: null, accion: null, texto: '', contexto: '', historial: [] };

function kzContextoActual(bloque) {
    const puesto = kz.data.proyecto_comisaria || document.getElementById('kz-comisaria')?.value || '';
    let ctx = puesto ? `Puesto del usuario: ${puesto}` : '';
    if (bloque === 'causa' && kz.data.problema)
        ctx += `\nProblema original: ${kz.data.problema}`;
    if (bloque === 'solucion' && kz.data.porques)
        ctx += `\nCausa raíz identificada: ${kz.data.porques.filter(Boolean).join(' → ')}`;
    return ctx;
}

async function kzAsistir(bloque, accion, texto) {
    if (accion !== 'ayudar' && (!texto || texto.trim().length < 3)) {
        kzAbrirChat(bloque, accion, texto);
        kzChatAgregarMensaje(kzPanelActivo(), 'assistant',
            'Escribe algo en el campo primero y luego pulsa "Mejorar redacción".', 'sugerencia');
        return;
    }
    kzAbrirChat(bloque, accion, texto);
    await kzChatLlamar();
}

function kzAbrirChat(bloque, accion, texto) {
    kzChat = { bloque, accion, texto: texto || '', contexto: kzContextoActual(bloque), historial: [] };
    const panel = kzPanelActivo();
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.querySelector('.kz-chat-msgs').innerHTML = '';
    panel.querySelector('.kz-chat-usar').classList.add('hidden');
    panel.querySelector('.kz-chat-input').value = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function kzChatLlamar(mensajeExtra) {
    const panel = kzPanelActivo();
    if (!panel) return;

    const historial = mensajeExtra
        ? [...kzChat.historial, { role: 'user', content: mensajeExtra }]
        : kzChat.historial;

    kzChatAgregarCargando(panel);

    try {
        const res = await fetch('/api/mejoras/asistir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify({
                bloque: kzChat.bloque,
                accion: kzChat.accion,
                texto: kzChat.texto.trim() || ' ',
                contexto: kzChat.contexto,
                historial: historial.length ? historial : null
            })
        });
        kzChatQuitarCargando(panel);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            kzChatAgregarMensaje(panel, 'assistant', `Error: ${err.detail || res.status}`, 'sugerencia');
            return;
        }
        const d = await res.json();

        if (mensajeExtra) {
            kzChat.historial.push({ role: 'user', content: mensajeExtra });
        }
        kzChat.historial.push({ role: 'assistant', content: d.respuesta });

        kzChatAgregarMensaje(panel, 'assistant', d.respuesta, d.tipo);

        // Mostrar botón "Usar" si hay texto entre «» o si el usuario confirmó
        if (d.respuesta.includes('«') || d.tipo !== 'pregunta') {
            panel.querySelector('.kz-chat-usar').classList.remove('hidden');
        }
    } catch {
        kzChatQuitarCargando(panel);
        kzChatAgregarMensaje(panel, 'assistant', 'No se pudo conectar con el servidor.', 'sugerencia');
    }
}

async function kzChatEnviar(panel) {
    const input = panel.querySelector('.kz-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    kzChatAgregarMensaje(panel, 'user', msg);
    await kzChatLlamar(msg);
}

function kzChatAgregarMensaje(panel, rol, texto, tipo) {
    const msgs = panel.querySelector('.kz-chat-msgs');
    const div = document.createElement('div');
    div.className = rol === 'user' ? 'kz-chat-msg kz-chat-msg-user' : `kz-chat-msg kz-chat-msg-ia kz-chat-msg-${tipo || 'sugerencia'}`;
    div.innerHTML = texto.replace(/«([^»]+)»/g, '<strong class="kz-chat-sugerido">«$1»</strong>');
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function kzChatAgregarCargando(panel) {
    const msgs = panel.querySelector('.kz-chat-msgs');
    const div = document.createElement('div');
    div.className = 'kz-chat-msg kz-chat-msg-ia kz-chat-cargando';
    div.id = 'kz-chat-loading';
    div.textContent = 'Pensando…';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function kzChatQuitarCargando(panel) {
    panel.querySelector('#kz-chat-loading')?.remove();
}

function kzUsarRespuesta(panel) {
    // Extrae texto entre «» del último mensaje IA, o usa el mensaje completo
    const mensajes = panel.querySelectorAll('.kz-chat-msg-ia');
    const ultimo = mensajes[mensajes.length - 1];
    if (!ultimo) return;

    let texto = ultimo.textContent;
    const match = texto.match(/«([^»]+)»/);
    if (match) texto = match[1];

    const campoId = KZ_CAMPOS_BLOQUE[kz.bloqueActual];
    if (campoId) {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.value = texto;
            campo.dispatchEvent(new Event('input')); // dispara oninput para guardar en kz.data
            campo.focus();
            campo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    panel.querySelector('.kz-chat-usar').classList.add('hidden');
    panel.querySelector('.kz-chat-input').focus();
}

function kzPanelActivo() {
    return document.querySelector('.kz-bloque-active .kz-ia-panel');
}

function kzLimpiarIA() {
    document.querySelectorAll('.kz-ia-panel').forEach(p => {
        p.classList.add('hidden');
        const msgs = p.querySelector('.kz-chat-msgs');
        if (msgs) msgs.innerHTML = '';
        p.querySelector('.kz-chat-usar')?.classList.add('hidden');
    });
}
