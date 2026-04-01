import { validateForm } from './validation.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// --- UTM capture ---
const params = new URLSearchParams(window.location.search);
const utmData = {
  fuente: params.get('utm_source') || params.get('fuente') || null,
  utm_medium: params.get('utm_medium') || null,
  utm_campaign: params.get('utm_campaign') || null,
};

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

// --- Stepper refs (initialized in DOMContentLoaded) ---
let stepperSteps, stepperLines, sectionCards;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  stepperSteps = document.querySelectorAll('.stepper-step');
  stepperLines = document.querySelectorAll('.stepper-line');
  sectionCards = document.querySelectorAll('#postulacion-form .section-card');

  loadCatalogs();
  puestoSelect.addEventListener('change', togglePuestoOtro);
  form.addEventListener('submit', handleSubmit);
  initStepper();
});

// =====================
// Catalog loading
// =====================

async function loadCatalogs() {
  try {
    const [clientesRes, categoriasRes, ciudadesRes] = await Promise.all([
      fetchJSON('/api/public/catalogo/clientes'),
      fetchJSON('/api/public/catalogo/categorias'),
      fetchJSON('/api/public/catalogo/ciudades'),
    ]);

    if (categoriasRes?.ok) {
      populateSelect('puesto_interes', categoriasRes.data.categorias, true);
    }
    if (ciudadesRes?.ok) {
      populateSelect('ciudad_interes', ciudadesRes.data.ciudades);
    }
    if (clientesRes?.ok) {
      const soloNemak = clientesRes.data.clientes.filter(c => c.nombre.toUpperCase() === 'NEMAK');
      buildClienteCheckboxes(soloNemak);
    }
  } catch (err) {
    console.error('Error cargando catálogos:', err);
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
// Stepper (focus + input based)
// =====================

function initStepper() {
  if (!sectionCards.length || !stepperSteps.length) return;

  const stepperNav = document.querySelector('.stepper');
  let currentStep = 0;

  function sectionHasData(card) {
    for (const el of card.querySelectorAll('input, select, textarea')) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) return true;
      } else if (el.value.trim()) {
        return true;
      }
    }
    return false;
  }

  function updateStepperUI() {
    stepperSteps.forEach((step, i) => {
      const hasFill = sectionHasData(sectionCards[i]);
      step.classList.toggle('is-active', i === currentStep);
      step.classList.toggle('is-done', i !== currentStep && hasFill);
    });
    stepperLines.forEach((line, i) => {
      line.classList.toggle('is-done', sectionHasData(sectionCards[i]));
    });
  }

  // Update active step on focus
  sectionCards.forEach((card, i) => {
    card.addEventListener('focusin', () => {
      if (i !== currentStep) {
        currentStep = i;
        updateStepperUI();
      }
    });
  });

  // Re-evaluate done state on any input change
  form.addEventListener('input', updateStepperUI);
  form.addEventListener('change', updateStepperUI);

  // Sticky shadow
  if (stepperNav) {
    window.addEventListener('scroll', () => {
      stepperNav.classList.toggle('is-stuck', stepperNav.getBoundingClientRect().top <= 0);
    }, { passive: true });
  }
}
