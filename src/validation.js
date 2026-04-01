/**
 * Valida los datos del formulario de postulación.
 * @param {object} data - Datos recolectados del formulario
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateForm(data) {
  const errors = {};

  // Nombre — requerido, 1-200 chars
  const nombre = (data.nombre || '').trim();
  if (!nombre) {
    errors.nombre = 'El nombre es obligatorio';
  } else if (nombre.length > 200) {
    errors.nombre = 'Máximo 200 caracteres';
  }

  // Teléfono — requerido, 10 dígitos locales o con prefijo +52
  const tel = (data.telefono_e164 || '').trim();
  if (!tel) {
    errors.telefono_e164 = 'El teléfono es obligatorio';
  } else if (!isValidPhone(tel)) {
    errors.telefono_e164 = 'Ingresa un número de 10 dígitos';
  }

  // Email — opcional, pero si se proporciona debe ser válido
  const email = (data.email || '').trim();
  if (email && !isValidEmail(email)) {
    errors.email = 'Ingresa un email válido';
  } else if (email.length > 300) {
    errors.email = 'Máximo 300 caracteres';
  }

  // Apellidos — max 200
  if ((data.apellido_paterno || '').length > 200) {
    errors.apellido_paterno = 'Máximo 200 caracteres';
  }
  if ((data.apellido_materno || '').length > 200) {
    errors.apellido_materno = 'Máximo 200 caracteres';
  }

  // Municipio — max 100
  if ((data.municipio || '').length > 100) {
    errors.municipio = 'Máximo 100 caracteres';
  }

  // Puesto otro — max 200, solo si puesto_interes es "Otro"
  if (data.puesto_interes === '__otro__' && (data.puesto_interes_otro || '').length > 200) {
    errors.puesto_interes_otro = 'Máximo 200 caracteres';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Valida teléfono mexicano: 10 dígitos locales, o con prefijo +52 / +521.
 */
function isValidPhone(tel) {
  const cleaned = tel.replace(/[\s\-()]/g, '');
  return /^(\+?52\d{10}|\+?521\d{10}|\d{10})$/.test(cleaned);
}

/**
 * Validación básica de email.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
