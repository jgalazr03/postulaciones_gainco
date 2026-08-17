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
const FOLIO_KEY = 'gainco.apoyo-escolar.folio';

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

const VISTAS = [
  'view-loading', 'view-cerrado', 'view-inicio', 'view-form',
  'view-acuse', 'view-regreso', 'view-rechazo', 'view-rescate',
];

/**
 * Sesión local: el token del link personal y el folio, para que el botón de
 * «ya me registré» pueda decir CUÁL registro es. El folio no es secreto (se
 * muestra en pantalla y se dicta por teléfono); el token sí, y por eso ninguno
 * de los dos viaja a otro lado que no sea este navegador.
 */
function guardarSesion(token, folio) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (folio) localStorage.setItem(FOLIO_KEY, folio);
  } catch { /* modo privado: se pierde la comodidad, no el registro */ }
}

function leerSesion() {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      folio: localStorage.getItem(FOLIO_KEY),
    };
  } catch { return { token: null, folio: null }; }
}

function setView(id) {
  VISTAS.forEach((v) => hide(document.getElementById(v)));
  show(document.getElementById(id));
  // `behavior: 'instant'` sólo es válido desde Chrome 97; antes, el valor
  // inválido invalida el objeto entero y el scroll no ocurre. `auto` es el
  // mismo comportamiento (salto sin animar) y existe desde siempre.
  window.scrollTo({ top: 0, behavior: 'auto' });
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

/**
 * Cada campo recuerda su texto de ayuda la primera vez que se ve, para poder
 * restaurarlo al limpiar un error. Sin esto, escribir en «Número de acceso»
 * borraba para siempre el «Es el número que trae tu gafete» — y con
 * `.field-support:empty` colapsando el espacio, además brincaba el layout.
 */
function recordarAyudas(root = document) {
  $$('.field', root).forEach((f) => {
    if (f.dataset.ayuda !== undefined) return;
    const support = $('.field-support', f);
    if (support) f.dataset.ayuda = support.textContent.trim();
  });
}

function limpiarError(fieldEl) {
  if (!fieldEl) return;
  fieldEl.classList.remove('is-error');
  const support = $('.field-support', fieldEl);
  if (support) support.textContent = fieldEl.dataset.ayuda || '';
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
  limpiarError($('#f-acceso'));
  limpiarError($('#f-telefono'));
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

  recordarAyudas(cont);
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
        // El backend descarta la solicitud (201 falso, cero escritura) si este
        // campo trae valor. Una persona nunca lo ve; sólo un bot que llena
        // todos los inputs del DOM.
        website: $('#website')?.value || undefined,
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
    guardarSesion(data.token, data.folio);
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

/**
 * Sube un documento y REEVALÚA la pantalla contra el estado nuevo.
 *
 * 🐞 Antes repintaba `#docs-lista` fijo, el contenedor del paso 3. Quien subía
 * desde la pantalla de regreso —que es el camino principal: ahí llega el acuse
 * ámbar, el botón «Ya me registré», el rescate por folio y el link `?t=`—
 * repintaba un contenedor OCULTO, así que su renglón se quedaba en «Subiendo…»
 * con `is-busy` (opacidad 0.6 y sin eventos) para siempre. Recargar lo
 * arreglaba porque `abrirRegreso` sí pinta el contenedor correcto.
 *
 * Y aun arreglando eso quedaba el hueco de fondo: quien completaba sus papeles
 * al volver nunca veía el acuse verde, la ÚNICA pantalla autorizada a decir
 * «ya no tienes que hacer nada más». Por eso al terminar se delega en
 * `mostrarSolicitud()` en vez de repintar y ya.
 */
async function subirDocumento(file, tipo, beneficiarioId, uploadEl) {
  uploadEl.classList.add('is-busy');
  const ayuda = $('[data-ayuda]', uploadEl);
  const ayudaOriginal = ayuda.textContent;
  ayuda.textContent = 'Subiendo…';

  // El contenedor se deriva del DOM, no se nombra: es la única fuente que no
  // puede desincronizarse de dónde está mirando el trabajador.
  const contenedor = uploadEl.closest('[data-docs-lista]');
  const contexto = contenedor?.dataset.docsLista;

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

    if (contexto === 'alta') {
      // Dentro del alta el trabajador sigue en su flujo: se repinta y él
      // decide cuándo tocar «Terminar». Sacarlo de aquí le quitaría el control
      // justo cuando todavía puede subir el papel del siguiente hijo.
      renderDocs(contenedor);
    } else {
      // Subir no des-rechaza: el estado lo cambia RH, así que la pantalla
      // vuelve a ser la del rechazo. Sin este aviso, reenviar la foto se
      // sentiría como que no pasó nada.
      if (contexto === 'rechazo') {
        snackbar('Recibimos tu foto nueva. Recursos Humanos la va a revisar otra vez.');
      }
      mostrarSolicitud();
    }
  } catch (err) {
    snackbar(err.message);
    ayuda.textContent = ayudaOriginal;
  } finally {
    // El nodo puede haber sido reemplazado por el repintado; quitar la clase
    // de un huérfano es inocuo y cubre el camino de error, donde sigue vivo.
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

  // 'alta' | 'regreso' | 'rechazo' — cambia el énfasis de lo pendiente.
  const contexto = contenedor.dataset.docsLista;

  const faltantesPorHijo = new Map(
    (state.solicitud.faltantes || []).map((f) => [f.beneficiario_id, f.tipos]),
  );

  state.solicitud.beneficiarios.forEach((b) => {
    const nodo = $('#tpl-docs-hijo').content.cloneNode(true);
    const card = $('[data-docs-hijo]', nodo);
    $('[data-nombre]', card).textContent = b.nombre;

    const faltan = faltantesPorHijo.get(b.id) || [];
    const chip = $('[data-faltan]', card);
    // El hijo que ya está completo lo dice, no sólo deja de quejarse: con
    // varios hijos, la ausencia de aviso se confunde con «todavía no lo he
    // revisado». Es el mismo criterio del acuse — el verde se gana.
    //
    // Salvo en la pantalla de rechazo: ahí «Completo» sería un desmentido del
    // párrafo de arriba, donde RH explica que los papeles no sirvieron. Tener
    // los archivos y que valgan son dos cosas distintas.
    if (faltan.length) {
      chip.textContent = faltan.length === 1 ? 'Falta 1' : `Faltan ${faltan.length}`;
      chip.classList.add('chip-warn');
      chip.classList.remove('chip-ok');
      show(chip);
    } else if (contexto !== 'rechazo') {
      chip.textContent = 'Completo';
      chip.classList.add('chip-ok');
      chip.classList.remove('chip-warn');
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
        // En la pantalla de rechazo el papel está entregado pero NO aprobado:
        // pintarlo verde diría «esto ya quedó» justo debajo del texto donde RH
        // explica que no sirve. Se muestra neutro, y sigue siendo reemplazable.
        const rechazado = contexto === 'rechazo';
        label.classList.add(rechazado ? 'is-sent' : 'is-done');
        $('[data-ayuda]', label).textContent = rechazado
          ? 'Ya la mandaste · toca para cambiarla'
          : 'Ya la recibimos · toca para cambiarla';
        $('[data-avatar]', label).innerHTML = rechazado
          ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.4"/></svg>'
          : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      } else {
        // `is-missing` (ámbar) existía en la hoja de estilos desde el primer
        // día y ningún camino lo aplicaba: un papel pendiente se veía igual
        // que uno que el trabajador ni ha mirado.
        //
        // Pero sólo se marca al VOLVER. Durante el alta, todos los papeles
        // están pendientes por definición: teñir de ámbar la pantalla entera
        // en el paso 3 convertiría el estado normal en una alarma. Al volver
        // es distinto — entró justamente a completar, y lo que falta es la
        // respuesta a la pregunta que trae.
        if (contexto !== 'alta') label.classList.add('is-missing');
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
  // Que RH ya lo haya revisado y aceptado es MÁS que tener los papeles
  // completos, y el acuse lo dice: si no, un trabajador aprobado y otro cuyo
  // expediente nadie ha abierto leen exactamente la misma pantalla.
  const aprobada = s.estado === 'validada';

  $('#acuse-folio').textContent = s.folio;

  const icono = $('#acuse-icon');
  icono.classList.toggle('ok', completo);
  icono.classList.toggle('warn', !completo);
  icono.innerHTML = completo
    ? '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
    : '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.5v5"/><circle cx="12" cy="17" r="1.15" fill="currentColor" stroke="none"/><path d="M10.3 3.9 2.6 17.4A1.9 1.9 0 0 0 4.3 20.3h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/></svg>';

  if (completo) {
    // Única pantalla del flujo autorizada a decir que ya no hay nada que hacer.
    const n = s.beneficiarios.length;
    const hijos = n === 1 ? 'tu hijo' : `tus ${n} hijos`;

    $('#acuse-titulo').textContent = aprobada
      ? 'Tu apoyo quedó aprobado.'
      : 'Listo. Ya no tienes que hacer nada más.';
    $('#acuse-mensaje').textContent = aprobada
      ? `Recursos Humanos revisó los papeles de ${hijos} y los aceptó.`
      : `Recibimos tu registro y los papeles de ${hijos}.`;

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

    // Sin fecha de cierre el renglón se oculta en vez de quedarse vacío: un
    // <div> sin texto dentro del panel deja el gap de 10px de `.panel` y se
    // lee como un hueco sin causa.
    const cierre = s.programa?.cierre;
    const deadline = $('#acuse-deadline');
    if (cierre) {
      deadline.textContent = `Tienes hasta el ${formatearFecha(cierre)}.`;
      show(deadline);
    } else {
      hide(deadline);
    }

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

/**
 * '2026-08-21' → 'viernes 21 de agosto'. La fecha la genera el backend; aquí
 * sólo se le da forma para leerla dentro de una frase, y por eso se quita la
 * coma que mete `toLocaleDateString` («viernes, 21 de agosto» lee raro en
 * «Tienes hasta el …»).
 */
function formatearFecha(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '');
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
    // «Puedes volver después» no dice CÓMO ni A DÓNDE, y la instrucción de
    // guardar el folio sólo vivía en el acuse — quien cierra aquí nunca la
    // veía. Este aviso es, para mucha gente, la última pantalla que lee.
    nota.innerHTML =
      `<div class="label">Tu registro ya quedó guardado</div>
       <p class="body" style="font-size:15px;line-height:21px">
         Tu folio es <b>${escapar(state.solicitud.folio)}</b>.
         <b>Toma una captura de pantalla</b> para no perderlo.
       </p>
       <p class="body" style="font-size:15px;line-height:21px">
         Si no tienes los papeles ahora, puedes cerrar. Para volver, entra al
         mismo link y toca <b>«Ya me registré»</b>.
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
  mostrarSolicitud();
}

/**
 * Decide qué pantalla le toca al estado ACTUAL de la solicitud.
 *
 * Existe porque antes no existía: cada camino —carga con `?t=`, rescate por
 * folio, fin de una subida— elegía su vista por su cuenta, y por eso divergían.
 * El caso que lo destapó: una solicitud RECHAZADA con los papeles completos
 * entraba por la rama `completo` y le mostraba al trabajador el acuse VERDE
 * («ya no tienes que hacer nada más») de un apoyo que no va a recibir. El
 * backend mandaba `estado` y `motivo_rechazo` desde el primer día; nadie los
 * leía.
 *
 * El orden importa: lo que RH decidió pesa más que el conteo de papeles.
 */
function mostrarSolicitud() {
  const s = state.solicitud;
  if (!s) return;
  if (s.estado === 'rechazada') renderRechazo();
  else if (s.completo) renderAcuse();
  else renderRegreso();
}

/** Faltan papeles: la lista de lo pendiente, hijo por hijo. */
function renderRegreso() {
  const s = state.solicitud;

  $('#regreso-titulo').textContent = 'Te faltan papeles';
  $('#regreso-sub').textContent = `${s.nombre} · folio ${s.folio}`;

  // Pasado el cierre el backend rechaza la subida (`assertProgramaAbierto`),
  // pero los botones se veían idénticos: el trabajador se enteraba DESPUÉS de
  // esperar a que subiera la foto, con un snackbar. Se avisa antes.
  const abierto = programaAbierto();
  $('#regreso-cerrado').classList.toggle('hidden', abierto);
  $('#regreso-lista').classList.toggle('hidden', !abierto);

  if (abierto) renderDocs($('#regreso-lista'));
  setView('view-regreso');
}

/** RH revisó y no aceptó. Con el motivo textual y, si aún hay plazo, la salida. */
function renderRechazo() {
  const s = state.solicitud;

  $('#rechazo-folio').textContent = s.folio;
  $('#rechazo-sub').textContent = `${s.nombre} · folio ${s.folio}`;
  $('#rechazo-motivo').textContent =
    s.motivo_rechazo || 'No nos dejaron anotado el motivo. Pregunta en la oficina.';

  // Un rechazo no es el final mientras haya plazo: al volver a tomar la foto,
  // la nueva reemplaza a la anterior (`upsertDocumento` ya lo soporta). Sin
  // esta salida, la pantalla sería una puerta cerrada.
  const abierto = programaAbierto();
  $('#rechazo-accion').classList.toggle('hidden', !abierto);
  if (abierto) renderDocs($('#rechazo-lista'));

  setView('view-rechazo');
}

/**
 * ¿Sigue abierto el plazo? Se lee del programa que devolvió el backend —la
 * ventana la evalúa Postgres con `CURRENT_DATE`, nunca el reloj del celular,
 * que en estos teléfonos puede ir días desfasado.
 */
function programaAbierto() {
  return state.programa?.abierto !== false;
}

// ============================================================
// Arranque
// ============================================================

async function init() {
  const params = new URLSearchParams(window.location.search);

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

  montarRescate();
  montarConsulta();

  // El token en la URL ES una credencial explícita: quien abre SU link personal
  // va directo a su trámite. Lo que ya no ocurre es el salto automático por
  // `localStorage`: en planta se presta el celular, y ese atajo metía al
  // compañero dentro del registro ajeno. Ahora eso se elige en la bifurcación.
  const tokenURL = params.get('t');
  if (tokenURL) {
    await abrirRegreso(tokenURL);
    return;
  }

  if (params.get('rescate') === '1') {
    setView('view-rescate');
    return;
  }

  if (!state.programa.abierto) {
    setView('view-cerrado');
    return;
  }

  cargarBorrador();
  pintarCatalogo();
  renderHijos();
  recordarAyudas();
  montarFormulario();
  montarInicio();
  setView('view-inicio');
}

/**
 * Bifurcación de entrada. Dos caminos explícitos —registrarse o volver— en vez
 * de aterrizar en un formulario largo: es una sola decisión, y hace visible el
 * regreso, que antes vivía escondido al final del paso 1.
 */
function montarInicio() {
  const { folio } = leerSesion();

  // Si este teléfono ya tiene un registro, el segundo botón deja de ser una
  // pregunta y pasa a nombrarlo. Y aparece la salida para quien NO es esa
  // persona — el caso del celular prestado.
  if (folio) {
    $('#btn-ya-registrado').textContent = `Continuar con mi registro (${folio})`;
    show($('#btn-otro-registro'));
  }

  $('#btn-registrarme').addEventListener('click', () => {
    irAPaso(1);
    setView('view-form');
  });

  $('#btn-ya-registrado').addEventListener('click', async () => {
    const { token } = leerSesion();
    if (token) await abrirRegreso(token);
    else setView('view-rescate');
  });

  $('#btn-otro-registro').addEventListener('click', () => setView('view-rescate'));
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

  $('#btn-volver-inicio').addEventListener('click', () => setView('view-inicio'));

  $$('#form-datos input, #form-datos select').forEach((el) => {
    el.addEventListener('input', () => limpiarError(el.closest('.field')));
  });
}

/**
 * Botones de las pantallas de CONSULTA (acuse y regreso).
 *
 * Se montan siempre, no dentro de `montarFormulario`: a esas dos vistas se
 * llega también por el link `?t=` y por el rescate con folio, caminos donde
 * `init()` retorna antes de montar el formulario. Vivían ahí y, por esas dos
 * entradas, sus botones quedaban muertos.
 */
function montarConsulta() {
  $('#btn-subir-ahora').addEventListener('click', renderRegreso);
  $('#btn-ver-acuse').addEventListener('click', renderAcuse);
}

function montarRescate() {
  const form = $('#form-rescate');
  if (!form || form.dataset.montado) return;
  form.dataset.montado = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const folio = $('#folio').value.trim().toUpperCase();
    const acceso = $('#acceso_rescate').value.trim();

    limpiarError($('#f-folio'));
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
      guardarSesion(data.token, data.folio);
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
