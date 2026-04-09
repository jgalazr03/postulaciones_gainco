import { validateForm } from './validation.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// --- UTM capture ---
const params = new URLSearchParams(window.location.search);
const utmData = {
  fuente: params.get('utm_source') || params.get('fuente') || null,
  utm_medium: params.get('utm_medium') || null,
  utm_campaign: params.get('utm_campaign') || null,
};

// --- State ---
let selectedVacanteId = null;

// --- DOM refs ---
const form = document.getElementById('postulacion-form');
const btnSubmit = document.getElementById('btn-submit');
const btnSubmitText = document.getElementById('btn-submit-text');
const globalError = document.getElementById('global-error');
const globalErrorText = document.getElementById('global-error-text');
const formView = document.getElementById('form-view');
const confirmView = document.getElementById('confirm-view');
const puestoSelect = document.getElementById('puesto_interes');
const puestoOtroWrapper = document.getElementById('puesto-otro-wrapper');

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  puestoSelect.addEventListener('change', togglePuestoOtro);
  form.addEventListener('submit', handleSubmit);
  initBlurValidation();

  document.getElementById('btn-skip-vacante').addEventListener('click', () => {
    document.querySelectorAll('.vacante-card.is-selected').forEach(c => c.classList.remove('is-selected'));
    selectedVacanteId = null;
    document.getElementById('btn-skip-vacante').classList.add('hidden');
  });
});

// =====================
// Data loading
// =====================

async function loadData() {
  try {
    const [vacantesRes, clientesRes] = await Promise.all([
      fetchJSON('/api/public/vacantes'),
      fetchJSON('/api/public/catalogo/clientes'),
    ]);

    // Build vacancy cards if there are open positions
    if (vacantesRes?.ok && vacantesRes.data.vacantes.length > 0) {
      buildVacanteCards(vacantesRes.data.vacantes);
      document.getElementById('vacantes-section').classList.remove('hidden');
    }

    // Populate dropdowns from vacantes filtros, fallback to individual catalogs
    let ciudades = vacantesRes?.ok ? vacantesRes.data.filtros.ciudades : [];
    let categorias = vacantesRes?.ok ? vacantesRes.data.filtros.categorias : [];

    if (!ciudades.length) {
      const ciudadesRes = await fetchJSON('/api/public/catalogo/ciudades');
      ciudades = ciudadesRes?.ok ? ciudadesRes.data.ciudades : [];
    }
    if (!categorias.length) {
      const categoriasRes = await fetchJSON('/api/public/catalogo/categorias');
      categorias = categoriasRes?.ok ? categoriasRes.data.categorias : [];
    }

    populateSelect('ciudad_interes', ciudades);
    populateSelect('puesto_interes', categorias, true);

    // Clients for "experiencia previa" section
    if (clientesRes?.ok) {
      buildClienteCheckboxes(clientesRes.data.clientes);
    }
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

async function fetchJSON(path) {
  if (!API_BASE) {
    console.warn('VITE_API_BASE no configurado. Crea un archivo .env con la URL del backend.');
    return null;
  }
  const res = await fetch(`${API_BASE}${path}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Respuesta no es JSON: ${contentType}`);
  }
  return res.json();
}

function populateSelect(selectId, items, addOtro = false) {
  const select = document.getElementById(selectId);
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
  if (addOtro) {
    const opt = document.createElement('option');
    opt.value = '__otro__';
    opt.textContent = 'Otro';
    select.appendChild(opt);
  }
}

// =====================
// Vacante cards
// =====================

function buildVacanteCards(vacantes) {
  const container = document.getElementById('vacantes-list');
  container.innerHTML = '';

  vacantes.forEach(v => {
    const card = document.createElement('div');
    card.className = 'vacante-card';
    card.dataset.vacanteId = v.id;

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-sm font-semibold text-on-surface">${escapeHtml(v.titulo)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(v.cliente_nombre)} · ${escapeHtml(v.ciudad)}</p>
        </div>
        <span class="vacante-badge">${v.posiciones_disponibles} ${v.posiciones_disponibles === 1 ? 'lugar' : 'lugares'}</span>
      </div>
      ${v.descripcion_publica ? `<p class="text-xs text-on-surface-variant mt-1.5 line-clamp-2">${escapeHtml(v.descripcion_publica)}</p>` : ''}
    `;

    card.addEventListener('click', () => selectVacante(card, v));
    container.appendChild(card);
  });
}

function selectVacante(card, vacante) {
  document.querySelectorAll('.vacante-card.is-selected').forEach(c => c.classList.remove('is-selected'));
  card.classList.add('is-selected');
  selectedVacanteId = vacante.id;

  // Show skip button
  document.getElementById('btn-skip-vacante').classList.remove('hidden');

  // Pre-fill dropdowns
  const ciudadSelect = document.getElementById('ciudad_interes');
  if (vacante.ciudad) ciudadSelect.value = vacante.ciudad;
  if (vacante.categoria) {
    puestoSelect.value = vacante.categoria;
    togglePuestoOtro();
  }
}

// =====================
// Puesto "Otro" toggle
// =====================

function togglePuestoOtro() {
  const isOtro = puestoSelect.value === '__otro__';
  puestoOtroWrapper.classList.toggle('hidden', !isOtro);
  if (!isOtro) {
    document.getElementById('puesto_interes_otro').value = '';
  }
}

// =====================
// Experiencia clientes (sección 5)
// =====================

function buildClienteCheckboxes(clientes) {
  const container = document.getElementById('clientes-list');
  if (!clientes.length) {
    container.closest('.section-card').classList.add('hidden');
    return;
  }

  clientes.forEach(cliente => {
    const wrapper = document.createElement('div');
    wrapper.dataset.clienteId = cliente.id;
    wrapper.className = 'cliente-card';

    wrapper.innerHTML = `
      <label class="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input type="checkbox" class="cliente-cb w-5 h-5 accent-brand-blue rounded" value="${cliente.id}" />
        <span class="text-sm font-medium text-on-surface">${escapeHtml(cliente.nombre)}</span>
      </label>
      <div class="cliente-sub mt-2 pl-8 space-y-1">
        <p class="text-xs text-on-surface-variant mb-1">¿Cómo fue?</p>
        <label class="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
          <input type="radio" name="tipo-${cliente.id}" value="directa" class="w-4 h-4 accent-brand-blue" />
          <span class="text-sm text-on-surface-variant">Directamente con la empresa</span>
        </label>
        <label class="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
          <input type="radio" name="tipo-${cliente.id}" value="externa" class="w-4 h-4 accent-brand-blue" />
          <span class="text-sm text-on-surface-variant">Con otra compañía</span>
        </label>
      </div>
    `;

    const cb = wrapper.querySelector('.cliente-cb');
    const sub = wrapper.querySelector('.cliente-sub');
    cb.addEventListener('change', () => {
      sub.classList.toggle('is-open', cb.checked);
      wrapper.classList.toggle('is-checked', cb.checked);
      if (!cb.checked) {
        sub.querySelectorAll('input[type="radio"]').forEach(r => (r.checked = false));
      }
    });

    container.appendChild(wrapper);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =====================
// Collect form data
// =====================

function collectFormData() {
  const val = (id) => document.getElementById(id)?.value.trim() || '';
  const puestoVal = val('puesto_interes');

  return {
    nombre: val('nombre'),
    apellido_paterno: val('apellido_paterno') || null,
    apellido_materno: val('apellido_materno') || null,
    telefono_e164: val('telefono_e164'),
    email: val('email') || null,
    municipio: val('municipio') || null,
    ciudad_interes: val('ciudad_interes') || null,
    puesto_interes: puestoVal === '__otro__' ? null : (puestoVal || null),
    puesto_interes_otro: puestoVal === '__otro__' ? val('puesto_interes_otro') || null : null,
    experiencia_anios: val('experiencia_anios') || null,
    disponibilidad_turno: collectTurnos(),
    disponibilidad_inicio: val('disponibilidad_inicio') || null,
    vacante_id: selectedVacanteId || null,
    experiencia_clientes: collectExperienciaClientes(),
    ...utmData,
    website: document.getElementById('website').value,
  };
}

function collectTurnos() {
  return [...document.querySelectorAll('input[name="turno"]:checked')].map(cb => cb.value);
}

function collectExperienciaClientes() {
  const result = [];
  document.querySelectorAll('#clientes-list [data-cliente-id]').forEach(wrapper => {
    const cb = wrapper.querySelector('.cliente-cb');
    if (!cb.checked) return;
    const radio = wrapper.querySelector('input[type="radio"]:checked');
    if (radio) {
      result.push({ cliente_id: wrapper.dataset.clienteId, tipo: radio.value });
    }
  });
  return result;
}

// =====================
// Submit handler
// =====================

async function handleSubmit(e) {
  e.preventDefault();
  clearErrors();

  const data = collectFormData();
  const { valid, errors } = validateForm(data);

  if (!valid) {
    showFieldErrors(errors);
    return;
  }

  setButtonLoading(true);

  try {
    const res = await fetch(`${API_BASE}/api/public/postulaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const body = await res.json();

    if (res.ok && body.ok) {
      showConfirmation(data.nombre, data.telefono_e164);
      return;
    }

    if (res.status === 409) {
      showGlobalError('Ya tienes una postulación activa. Te contactaremos pronto.');
    } else if (res.status === 422 && body.error?.details) {
      const fieldErrors = {};
      body.error.details.forEach(d => {
        const field = d.path?.[0] || 'general';
        fieldErrors[field] = d.message;
      });
      showFieldErrors(fieldErrors);
    } else if (res.status === 429) {
      showGlobalError('Demasiados intentos. Espera un momento e intenta de nuevo.');
    } else {
      showGlobalError('Ocurrió un error. Intenta de nuevo.');
    }
  } catch {
    showGlobalError('Error de conexión. Verifica tu internet e intenta de nuevo.');
  } finally {
    setButtonLoading(false);
  }
}

// =====================
// Button loading state
// =====================

function setButtonLoading(loading) {
  btnSubmit.disabled = loading;
  if (loading) {
    btnSubmitText.innerHTML = '<span class="btn-spinner"></span> Enviando...';
  } else {
    btnSubmitText.textContent = 'Enviar postulación';
  }
}

// =====================
// Error display
// =====================

function clearErrors() {
  globalError.classList.add('hidden');
  globalErrorText.textContent = '';
  document.querySelectorAll('.field-error').forEach(el => (el.textContent = ''));
  document.querySelectorAll('.input-filled.has-error').forEach(el => el.classList.remove('has-error'));
}

function showFieldErrors(errors) {
  let firstField = null;
  for (const [field, message] of Object.entries(errors)) {
    const errorEl = document.getElementById(`error-${field}`);
    if (errorEl) {
      errorEl.textContent = message;
      const input = document.getElementById(field);
      if (input) input.classList.add('has-error');
      if (!firstField) firstField = input;
    }
  }
  if (firstField) {
    firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstField.focus();
  }
}

function showGlobalError(message) {
  globalErrorText.textContent = message;
  globalError.classList.remove('hidden');
  globalError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =====================
// Confirmation view
// =====================

function showConfirmation(nombre, telefono) {
  document.getElementById('confirm-nombre').textContent = nombre;
  document.getElementById('confirm-telefono').textContent = telefono;
  formView.classList.add('hidden');
  confirmView.classList.remove('hidden');
  window.scrollTo(0, 0);
}

// =====================
// Blur validation (real-time feedback for required fields)
// =====================

function initBlurValidation() {
  const nombreInput = document.getElementById('nombre');
  const telInput = document.getElementById('telefono_e164');
  const emailInput = document.getElementById('email');

  nombreInput.addEventListener('blur', () => {
    const val = nombreInput.value.trim();
    const errorEl = document.getElementById('error-nombre');
    if (!val) {
      errorEl.textContent = 'El nombre es obligatorio';
      nombreInput.classList.add('has-error');
    } else {
      errorEl.textContent = '';
      nombreInput.classList.remove('has-error');
    }
  });

  telInput.addEventListener('blur', () => {
    const val = telInput.value.trim();
    const errorEl = document.getElementById('error-telefono_e164');
    if (!val) {
      errorEl.textContent = 'El teléfono es obligatorio';
      telInput.classList.add('has-error');
    } else if (!/^(\+?52\d{10}|\+?521\d{10}|\d{10})$/.test(val.replace(/[\s\-()]/g, ''))) {
      errorEl.textContent = 'Ingresa un número de 10 dígitos';
      telInput.classList.add('has-error');
    } else {
      errorEl.textContent = '';
      telInput.classList.remove('has-error');
    }
  });

  emailInput.addEventListener('blur', () => {
    const val = emailInput.value.trim();
    const errorEl = document.getElementById('error-email');
    if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      errorEl.textContent = 'Ingresa un email válido';
      emailInput.classList.add('has-error');
    } else {
      errorEl.textContent = '';
      emailInput.classList.remove('has-error');
    }
  });
}

