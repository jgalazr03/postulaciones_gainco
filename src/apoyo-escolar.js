/**
 * Apoyo de útiles escolares — registro público.
 *
 * Vanilla JS, sin framework (convención del repo). Tres pasos, acuse, y una
 * pantalla de regreso para quien vuelve a completar sus papeles.
 *
 * DECISIÓN DE FLUJO — la solicitud se crea al terminar el PASO 2, no al final:
 * el censo (quién tiene cuántos hijos estudiando) es el dato que RH necesita
 * para negociar con la papelería, y los papeles pueden llegar después. Si la
 * creación esperara al último botón, un trabajador que se atora subiendo fotos
 * —el escenario más probable con esta población— no quedaría registrado. Así,
 * su registro está a salvo desde que termina de anotar a sus hijos.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';
const PROGRAMA = 'escolar_2026_2027';
const BORRADOR_KEY = 'gainco.apoyo-escolar.borrador';
const TOKEN_KEY = 'gainco.apoyo-escolar.token';

// Compresión de fotos: un celular de gama baja saca imágenes de 6-8 MB y con
// la red de una planta esa subida se cae. Sin esto se pierde gente real.
const FOTO_LADO_MAX = 1600;
const FOTO_CALIDAD = 0.75;

// ============================================================
// Estado
// ============================================================

const state = {
  programa: null,
  catalogo: { clientes: [], ciudades: [] },
  paso: 1,
  datos: { nombre: '', numero_acceso: '', telefono: '', cliente_id: '', ciudad: '' },
  hijos: [nuevoHijo()],
  solicitud: null,
  token: null,
};

function nuevoHijo() {
  return { nombre: '', fecha_nacimiento: '', nivel: '', escuela: '' };
}

// ============================================================
// Utilidades DOM
// ============================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

const VISTAS = ['view-loading', 'view-cerrado', 'view-form', 'view-acuse', 'view-regreso', 'view-rescate'];

function setView(id) {
  VISTAS.forEach((v) => hide(document.getElementById(v)));
  show(document.getElementById(id));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

let snackTimer = null;
function snackbar(mensaje) {
  const el = $('#snackbar');
  el.textContent = mensaje;
  show(el);
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => hide(el), 6000);
}

function marcarError(fieldEl, mensaje) {
  if (!fieldEl) return;
  fieldEl.classList.add('is-error');
  const support = $('.field-support', fieldEl);
  if (support) support.textContent = mensaje;
}

function limpiarError(fieldEl, ayudaOriginal = '') {
  if (!fieldEl) return;
  fieldEl.classList.remove('is-error');
  const support = $('.field-support', fieldEl);
  if (support) support.textContent = ayudaOriginal;
}

// ============================================================
// API
// ============================================================

async function api(path, { method = 'GET', body, formData } = {}) {
  const opciones = { method, headers: {} };

  if (formData) {
    opciones.body = formData; // el navegador pone el boundary de multipart
  } else if (body !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(body);
  }

  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE}${path}`, opciones);
  } catch {
    // Falla de red: el mensaje habla de la conexión del trabajador, no de HTTP.
    throw new Error('No se pudo conectar. Revisa tu internet e intenta de nuevo.');
  }

  let json = null;
  try { json = await respuesta.json(); } catch { /* respuesta sin cuerpo */ }

  if (!respuesta.ok || json?.ok === false) {
    throw new Error(json?.error?.message || 'Algo salió mal. Intenta de nuevo.');
  }
  return json?.data;
}

// ============================================================
// Borrador local (no perder la captura)
// ============================================================

function guardarBorrador() {
  try {
    localStorage.setItem(BORRADOR_KEY, JSON.stringify({ datos: state.datos, hijos: state.hijos }));
  } catch { /* modo privado o sin cuota: el borrador es una comodidad, no un requisito */ }
}

function cargarBorrador() {
  try {
    const crudo = localStorage.getItem(BORRADOR_KEY);
    if (!crudo) return;
    const { datos, hijos } = JSON.parse(crudo);
    if (datos) Object.assign(state.datos, datos);
    if (Array.isArray(hijos) && hijos.length) state.hijos = hijos;
  } catch { /* borrador corrupto: se ignora */ }
}

const limpiarBorrador = () => { try { localStorage.removeItem(BORRADOR_KEY); } catch { /* noop */ } };

// ============================================================
// Paso 1 — datos del trabajador
// ============================================================

function pintarCatalogo() {
  const selCliente = $('#cliente_id');
  const selCiudad = $('#ciudad');

  state.catalogo.clientes.forEach((c) => {
    const op = document.createElement('option');
    op.value = c.id;
    op.textContent = c.nombre;
    selCliente.append(op);
  });

  state.catalogo.ciudades.forEach((nombre) => {
    const op = document.createElement('option');
    op.value = nombre;
    op.textContent = nombre;
    selCiudad.append(op);
  });

  selCliente.value = state.datos.cliente_id || '';
  selCiudad.value = state.datos.ciudad || '';
  $('#nombre').value = state.datos.nombre || '';
  $('#numero_acceso').value = state.datos.numero_acceso || '';
  $('#telefono').value = state.datos.telefono || '';
}

function leerPaso1() {
  state.datos = {
    nombre: $('#nombre').value.trim(),
    numero_acceso: $('#numero_acceso').value.trim(),
    telefono: $('#telefono').value.trim(),
    cliente_id: $('#cliente_id').value,
    ciudad: $('#ciudad').value,
  };
}

function validarPaso1() {
  leerPaso1();
  let ok = true;
  const { nombre, numero_acceso: acceso, telefono, cliente_id: cliente, ciudad } = state.datos;

  limpiarError($('#f-nombre'));
  limpiarError($('#f-acceso'), 'Es el número que trae tu gafete.');
  limpiarError($('#f-telefono'), '10 dígitos, para buscarte si falta algo.');
  limpiarError($('#f-planta'));
  limpiarError($('#f-ciudad'));

  if (nombre.length < 3) {
    marcarError($('#f-nombre'), 'Escribe tu nombre completo.');
    ok = false;
  }
  if (!acceso) {
    // No es opcional en la práctica: es lo que le permite a RH encontrarte en
    // la nómina, porque el formulario no consulta la base de datos.
    marcarError($('#f-acceso'), 'Necesitamos tu número de gafete para encontrarte.');
    ok = false;
  }
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length < 10) {
    marcarError($('#f-telefono'), 'Escribe los 10 dígitos de tu celular.');
    ok = false;
  }
  if (!cliente) { marcarError($('#f-planta'), 'Selecciona tu planta.'); ok = false; }
  if (!ciudad) { marcarError($('#f-ciudad'), 'Selecciona tu ciudad.'); ok = false; }

  guardarBorrador();
  return ok;
}

// ============================================================
// Paso 2 — los hijos
// ============================================================

function renderHijos() {
  const cont = $('#hijos-lista');
  cont.textContent = '';

  state.hijos.forEach((hijo, i) => {
    const nodo = $('#tpl-hijo').content.cloneNode(true);
    const card = $('[data-hijo]', nodo);

    $('[data-titulo]', card).textContent = `Hijo ${i + 1}`;

    const quitar = $('[data-quitar]', card);
    // Con un solo hijo no se ofrece quitarlo: dejaría el formulario sin sentido.
    if (state.hijos.length === 1) hide(quitar);
    quitar.addEventListener('click', () => {
      state.hijos.splice(i, 1);
      if (!state.hijos.length) state.hijos.push(nuevoHijo());
      renderHijos();
      guardarBorrador();
    });

    $$('[data-campo]', card).forEach((input) => {
      const campo = input.dataset.campo;
      input.value = hijo[campo] || '';
      input.id = `hijo-${i}-${campo}`;
      const label = input.parentElement.querySelector('.field-label');
      if (label) label.setAttribute('for', input.id);

      input.addEventListener('input', () => {
        state.hijos[i][campo] = input.value;
        limpiarError(input.closest('.field'));
        guardarBorrador();
      });
    });

    cont.append(card);
  });
}

function validarPaso2() {
  let ok = true;

  state.hijos.forEach((hijo, i) => {
    const campo = (nombre) => document.getElementById(`hijo-${i}-${nombre}`)?.closest('.field');

    limpiarError(campo('nombre'));
    limpiarError(campo('fecha_nacimiento'));
    limpiarError(campo('nivel'));
    limpiarError(campo('escuela'));

    if (!hijo.nombre || hijo.nombre.trim().length < 2) {
      marcarError(campo('nombre'), 'Escribe el nombre del niño o niña.');
      ok = false;
    }
    if (!hijo.fecha_nacimiento) {
      marcarError(campo('fecha_nacimiento'), 'Falta la fecha de nacimiento.');
      ok = false;
    } else {
      const edad = edadEnAnios(hijo.fecha_nacimiento);
      const tope = state.programa?.config?.edad_maxima ?? 25;
      if (edad !== null && edad > tope) {
        marcarError(campo('fecha_nacimiento'), `El apoyo llega hasta los ${tope} años.`);
        ok = false;
      }
    }
    if (!hijo.nivel) {
      marcarError(campo('nivel'), 'Selecciona qué va a cursar.');
      ok = false;
    }
  });

  guardarBorrador();
  return ok;
}

/**
 * Edad en años. Sólo se usa para avisarle al trabajador antes de enviar; la
 * fecha de negocio siempre la manda el backend.
 */
function edadEnAnios(fechaISO) {
  const nacimiento = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1;
  return edad;
}

// ============================================================
// Creación de la solicitud (al salir del paso 2)
// ============================================================

async function crearSolicitud(botón) {
  const textoOriginal = botón.textContent;
  botón.disabled = true;
  botón.textContent = 'Guardando…';

  try {
    const data = await api(`/api/public/apoyos/${PROGRAMA}/solicitudes`, {
      method: 'POST',
      body: {
        nombre: state.datos.nombre,
        numero_acceso: state.datos.numero_acceso,
        telefono: state.datos.telefono,
        cliente_id: state.datos.cliente_id || null,
        ciudad: state.datos.ciudad || null,
        consentimiento: true,
        beneficiarios: state.hijos.map((h) => ({
          nombre: h.nombre.trim(),
          fecha_nacimiento: h.fecha_nacimiento || null,
          nivel: h.nivel || null,
          escuela: h.escuela?.trim() || null,
        })),
      },
    });

    state.token = data.token;
    state.solicitud = data;
    try { localStorage.setItem(TOKEN_KEY, data.token); } catch { /* noop */ }
    limpiarBorrador();

    irAPaso(3);
  } catch (err) {
    snackbar(err.message);
  } finally {
    botón.disabled = false;
    botón.textContent = textoOriginal;
  }
}

// ============================================================
// Documentos
// ============================================================

/**
 * Comprime la foto antes de subirla. Los PDF pasan intactos, y si la
 * compresión no mejora el tamaño se manda el original: nunca se entrega un
 * archivo peor que el que el trabajador eligió.
 */
async function comprimirImagen(file) {
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && file.size < 900_000) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', FOTO_CALIDAD));
    bitmap.close?.();

    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    // Si el navegador no puede procesarla, se sube tal cual: perder la foto
    // sería peor que subir una pesada.
    return file;
  }
}

async function subirDocumento(file, tipo, beneficiarioId, uploadEl) {
  uploadEl.classList.add('is-busy');
  const ayuda = $('[data-ayuda]', uploadEl);
  const ayudaOriginal = ayuda.textContent;
  ayuda.textContent = 'Subiendo…';

  try {
    const comprimido = await comprimirImagen(file);
    const formData = new FormData();
    formData.append('archivo', comprimido, comprimido.name);
    formData.append('tipo', tipo);
    if (beneficiarioId) formData.append('beneficiario_id', beneficiarioId);

    const data = await api(`/api/public/apoyos/solicitudes/${state.token}/documentos`, {
      method: 'POST', formData,
    });

    state.solicitud = data;
    renderDocs($('#docs-lista'));
  } catch (err) {
    snackbar(err.message);
    ayuda.textContent = ayudaOriginal;
  } finally {
    uploadEl.classList.remove('is-busy');
  }
}

/** Documentos requeridos del programa, con su etiqueta y su texto de ayuda. */
function requeridos() {
  const docs = state.programa?.config?.documentos || [];
  return docs.filter((d) => d.requerido !== false);
}

/**
 * Pinta, por hijo, un renglón por documento requerido. Es la misma vista en el
 * paso 3 y en la pantalla de regreso: lo que cambia es dónde se monta.
 */
function renderDocs(contenedor) {
  if (!contenedor || !state.solicitud) return;
  contenedor.textContent = '';

  const faltantesPorHijo = new Map(
    (state.solicitud.faltantes || []).map((f) => [f.beneficiario_id, f.tipos]),
  );

  state.solicitud.beneficiarios.forEach((b) => {
    const nodo = $('#tpl-docs-hijo').content.cloneNode(true);
    const card = $('[data-docs-hijo]', nodo);
    $('[data-nombre]', card).textContent = b.nombre;

    const faltan = faltantesPorHijo.get(b.id) || [];
    const chip = $('[data-faltan]', card);
    if (faltan.length) {
      chip.textContent = faltan.length === 1 ? 'Falta 1' : `Faltan ${faltan.length}`;
      show(chip);
    }

    const slots = $('[data-slots]', card);
    const entregados = new Set((b.documentos || []).map((d) => d.tipo));

    requeridos().forEach((req) => {
      const fila = $('#tpl-upload').content.cloneNode(true);
      const label = $('[data-upload]', fila);
      const input = $('[data-input]', fila);

      $('[data-etiqueta]', label).textContent = req.etiqueta || req.tipo;

      if (entregados.has(req.tipo)) {
        label.classList.add('is-done');
        $('[data-ayuda]', label).textContent = 'Ya la recibimos · toca para cambiarla';
        $('[data-avatar]', label).innerHTML =
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      } else {
        $('[data-ayuda]', label).textContent = req.ayuda || 'Toca para tomar la foto';
      }

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) subirDocumento(file, req.tipo, b.id, label);
        input.value = '';
      });

      slots.append(label);
    });

    contenedor.append(card);
  });
}

// ============================================================
// Acuse
// ============================================================

function renderAcuse() {
  const s = state.solicitud;
  const completo = s.completo;

  $('#acuse-folio').textContent = s.folio;

  const icono = $('#acuse-icon');
  icono.classList.toggle('ok', completo);
  icono.classList.toggle('warn', !completo);
  icono.innerHTML = completo
    ? '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
    : '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.5v5"/><circle cx="12" cy="17" r="1.15" fill="currentColor" stroke="none"/><path d="M10.3 3.9 2.6 17.4A1.9 1.9 0 0 0 4.3 20.3h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/></svg>';

  if (completo) {
    // Única pantalla del flujo autorizada a decir que ya no hay nada que hacer.
    $('#acuse-titulo').textContent = 'Listo. Ya no tienes que hacer nada más.';
    const n = s.beneficiarios.length;
    $('#acuse-mensaje').textContent =
      `Recibimos tu registro y los papeles de ${n === 1 ? 'tu hijo' : `tus ${n} hijos`}.`;
    hide($('#acuse-faltantes'));
    hide($('#acuse-consecuencia'));
    hide($('#btn-subir-ahora'));
    hide($('#acuse-oficina'));
  } else {
    $('#acuse-titulo').textContent = 'Te falta 1 paso';
    $('#acuse-mensaje').innerHTML =
      'Ya te apartamos, pero tu registro <b>todavía no está completo</b>.';

    const lista = $('#acuse-faltantes-lista');
    lista.textContent = '';
    (s.faltantes || []).forEach((f) => {
      const li = document.createElement('li');
      const etiquetas = f.etiquetas.join(' y ');
      li.innerHTML = `De <b>${escapar(f.beneficiario)}</b>: ${escapar(etiquetas.toLowerCase())}`;
      lista.append(li);
    });

    const cierre = s.programa?.cierre;
    $('#acuse-deadline').textContent = cierre
      ? `Tienes hasta el ${formatearFecha(cierre)}.`
      : '';

    show($('#acuse-faltantes'));
    show($('#acuse-consecuencia'));
    show($('#btn-subir-ahora'));
    show($('#acuse-oficina'));
  }

  setView('view-acuse');
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** '2026-08-21' → 'viernes 21 de agosto'. La fecha viene del backend. */
function formatearFecha(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ============================================================
// Navegación entre pasos
// ============================================================

const NOMBRES_PASO = { 1: 'Tus datos', 2: 'Tus hijos', 3: 'Papeles' };

function irAPaso(n) {
  state.paso = n;

  [1, 2, 3].forEach((i) => {
    document.getElementById(`step-${i}`).classList.toggle('hidden', i !== n);
  });

  $('#progress-paso').textContent = `Paso ${n} de 3`;
  $('#progress-nombre').textContent = NOMBRES_PASO[n];
  $('#progress-track').setAttribute('aria-valuenow', String(n));
  $$('#progress-track > span').forEach((s, i) => s.classList.toggle('on', i < n));

  // A partir del paso 3 el registro ya existe: la intro y el panel de mecánica
  // estorban, y no hay «regresar» porque los datos ya se enviaron.
  if (n === 3) {
    hide($('#form-intro'));
    hide($('#panel-mecanica'));
    renderDocs($('#docs-lista'));
    const aviso = $('#aviso-guardado');
    if (aviso) aviso.remove();
    const nota = document.createElement('div');
    nota.id = 'aviso-guardado';
    nota.className = 'panel panel-info';
    nota.innerHTML =
      `<div class="label">Tu registro ya quedó guardado</div>
       <p class="body" style="font-size:15px;line-height:21px">
         Tu folio es <b>${escapar(state.solicitud.folio)}</b>. Ahora sube los papeles;
         si no los tienes a la mano, puedes volver después.
       </p>`;
    $('#step-3').prepend(nota);
  }

  if (n === 2) renderHijos();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// Pantalla de regreso
// ============================================================

async function abrirRegreso(token) {
  state.token = token;
  try {
    state.solicitud = await api(`/api/public/apoyos/solicitudes/${token}`);
  } catch (err) {
    snackbar(err.message);
    setView('view-rescate');
    return;
  }

  if (state.solicitud.completo) {
    renderAcuse();
    return;
  }

  $('#regreso-titulo').textContent = 'Te faltan papeles';
  $('#regreso-sub').textContent =
    `${state.solicitud.nombre} · folio ${state.solicitud.folio}`;
  renderDocs($('#regreso-lista'));
  setView('view-regreso');
}

// ============================================================
// Arranque
// ============================================================

async function init() {
  const params = new URLSearchParams(window.location.search);

  // Enlaces de servicio: ?rescate=1 para quien perdió su link.
  if (params.get('rescate') === '1') {
    setView('view-rescate');
    montarRescate();
    return;
  }

  try {
    const [programa, catalogo] = await Promise.all([
      api(`/api/public/apoyos/${PROGRAMA}`),
      api('/api/public/apoyos/catalogo'),
    ]);
    state.programa = programa;
    state.catalogo = catalogo;
  } catch (err) {
    setView('view-cerrado');
    $('#view-cerrado').innerHTML =
      `<h1 class="headline">No pudimos cargar el registro</h1>
       <p class="body">${escapar(err.message)}</p>`;
    return;
  }

  if (state.programa.cierre) {
    const chip = $('#chip-cierre');
    chip.textContent = `Cierra el ${formatearFecha(state.programa.cierre)}`;
    show(chip);
  }

  // Quien ya se registró desde este celular vuelve a SU trámite, no a uno nuevo.
  const tokenURL = params.get('t');
  const tokenGuardado = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const token = tokenURL || tokenGuardado;

  if (token) {
    await abrirRegreso(token);
    montarRescate();
    return;
  }

  if (!state.programa.abierto) {
    setView('view-cerrado');
    return;
  }

  cargarBorrador();
  pintarCatalogo();
  renderHijos();
  montarFormulario();
  montarRescate();
  setView('view-form');
}

function montarFormulario() {
  $('#form-datos').addEventListener('submit', (e) => {
    e.preventDefault();
    if (validarPaso1()) irAPaso(2);
  });

  $('#btn-agregar-hijo').addEventListener('click', () => {
    state.hijos.push(nuevoHijo());
    renderHijos();
    guardarBorrador();
    // El bloque recién agregado es lo que el usuario quiere ver.
    $('#hijos-lista').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#btn-volver-1').addEventListener('click', () => irAPaso(1));

  $('#form-hijos').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarPaso2()) return;

    if (!$('#consentimiento').checked) {
      snackbar('Marca la casilla del aviso de privacidad para continuar.');
      $('#consentimiento-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    crearSolicitud(e.submitter || $('#form-hijos button[type="submit"]'));
  });

  // El paso 3 no tiene «regresar»: al llegar ahí la solicitud ya está creada y
  // los datos ya se enviaron, así que ofrecer volver prometería una edición
  // que no existe. Si se equivocó, RH lo corrige al conciliar.
  $('#btn-enviar').addEventListener('click', renderAcuse);
  $('#btn-subir-ahora').addEventListener('click', () => {
    renderDocs($('#regreso-lista'));
    $('#regreso-titulo').textContent = 'Te faltan papeles';
    $('#regreso-sub').textContent = `${state.solicitud.nombre} · folio ${state.solicitud.folio}`;
    setView('view-regreso');
  });

  $$('#form-datos input, #form-datos select').forEach((el) => {
    el.addEventListener('input', () => limpiarError(el.closest('.field'), ''));
  });
}

function montarRescate() {
  const form = $('#form-rescate');
  if (!form || form.dataset.montado) return;
  form.dataset.montado = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const folio = $('#folio').value.trim().toUpperCase();
    const acceso = $('#acceso_rescate').value.trim();

    limpiarError($('#f-folio'), 'Son 5 caracteres, como 7K4M2.');
    limpiarError($('#f-acceso-rescate'));

    if (folio.length !== 5) {
      marcarError($('#f-folio'), 'El folio tiene 5 caracteres.');
      return;
    }
    if (!acceso) {
      marcarError($('#f-acceso-rescate'), 'Escribe tu número de gafete.');
      return;
    }

    const botón = form.querySelector('button[type="submit"]');
    botón.disabled = true;
    botón.textContent = 'Buscando…';

    try {
      const data = await api('/api/public/apoyos/rescate', {
        method: 'POST', body: { folio, numero_acceso: acceso },
      });
      state.token = data.token;
      state.solicitud = data;
      try { localStorage.setItem(TOKEN_KEY, data.token); } catch { /* noop */ }
      await abrirRegreso(data.token);
    } catch {
      // Mensaje idéntico exista o no la solicitud: el backend tampoco
      // distingue, para que nadie pueda cosechar folios probando.
      snackbar('No encontramos un registro con ese folio y número de acceso.');
    } finally {
      botón.disabled = false;
      botón.textContent = 'Buscar mi registro';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
