# Guia Frontend — Formulario Publico de Postulacion

> **Fecha:** 2026-03-31
> **Audiencia:** Equipo que construira la landing page del formulario publico
> **Backend:** Migracion 060
> **Importante:** Esta landing page es independiente del panel de RH. Sera compartida en redes sociales.

---

## 1. Contexto

Este formulario permite a trabajadores operativos postularse a vacantes directamente desde un link compartido en Facebook, WhatsApp, volantes, etc. Los datos llegan al panel de RH donde deciden a quien entrevistar.

**Perfil del usuario:**
- Trabajadores operativos (soldadores, mecanicos, ayudantes generales, etc.)
- Noreste de Mexico (Monterrey, Saltillo, Monclova)
- Acceden desde celular (Android low-end/mid, datos moviles prepago)
- Abren el link desde el navegador in-app de WhatsApp o Facebook

**Implicaciones tecnicas:**
- Mobile-first obligatorio: formulario vertical, scroll unico, botones grandes
- Sin uploads de archivos (el in-app browser de WhatsApp los maneja mal)
- Ligero en peso: sin imagenes pesadas ni frameworks JS grandes
- Formulario completable en menos de 2 minutos

---

## 2. Endpoints disponibles (sin autenticacion)

Todos los endpoints del formulario son publicos. No requieren token.

**Base URL:** `https://<dominio-backend>/api/public`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/public/vacantes` | Vacantes abiertas + filtros derivados (nuevo) |
| GET | `/api/public/catalogo/clientes` | Lista de empresas (filtrado por vacantes si existen) |
| GET | `/api/public/catalogo/categorias` | Lista de puestos (filtrado por vacantes si existen) |
| GET | `/api/public/catalogo/ciudades` | Lista de ciudades (filtrado por vacantes si existen) |
| POST | `/api/public/postulaciones` | Enviar la postulacion |

### 2.1 GET /api/public/vacantes (NUEVO)

Retorna vacantes abiertas con campos publicos + filtros derivados de las vacantes existentes.

**Query params opcionales:** `?ciudad=Monterrey&categoria=Soldador&cliente_id=uuid`

**Response:**
```json
{
  "ok": true,
  "data": {
    "vacantes": [
      {
        "id": "uuid-vacante-1",
        "categoria": "Soldador",
        "titulo": "Soldador 6G con experiencia",
        "ciudad": "Monterrey",
        "cliente_id": "uuid-nemak",
        "descripcion_publica": "Buscamos soldadores con experiencia en proceso 6G para planta NEMAK.",
        "cantidad": 5,
        "posiciones_cubiertas": 2,
        "posiciones_disponibles": 3,
        "cliente_nombre": "NEMAK"
      }
    ],
    "filtros": {
      "ciudades": ["Monterrey", "Saltillo"],
      "categorias": ["Soldador", "Pailero"],
      "clientes": [
        { "id": "uuid-nemak", "nombre": "NEMAK" }
      ]
    }
  }
}
```

**Flujo recomendado:**
1. Al cargar la pagina, llamar `GET /api/public/vacantes` (sin filtros)
2. Usar `data.filtros` para poblar los dropdowns de ciudad, categoria y cliente
3. Mostrar las vacantes como cards: puesto + cliente + ciudad + descripcion breve
4. Cuando el usuario selecciona un filtro, llamar de nuevo con el query param correspondiente
5. Si no hay vacantes abiertas, `data.filtros` estara vacio — en ese caso usar los 3 catalogos como fallback

**Logica de fallback:** Si `filtros.ciudades` esta vacio, llamar `GET /api/public/catalogo/ciudades` para obtener la lista completa. Lo mismo para categorias y clientes.

### 2.2 GET /api/public/catalogo/clientes

Retorna los clientes activos (solo id y nombre, sin datos internos).
Acepta query param opcional `?ciudad=Monterrey` para filtrar por ciudad.
**Si hay vacantes abiertas, solo retorna clientes con vacantes.** Si no hay, retorna todos los activos.

**Response:**
```json
{
  "ok": true,
  "data": {
    "clientes": [
      { "id": "uuid-1", "nombre": "NEMAK" },
      { "id": "uuid-2", "nombre": "Ironcast" },
      { "id": "uuid-3", "nombre": "SRI" }
    ]
  }
}
```

Usar para construir la seccion "Has trabajado en alguna de estas empresas?".

### 2.3 GET /api/public/catalogo/categorias

Retorna la lista de categorias de puesto.
**Si hay vacantes abiertas, solo retorna categorias con vacantes.** Si no hay, retorna la lista completa.

**Response:**
```json
{
  "ok": true,
  "data": {
    "categorias": [
      "Automatizacion",
      "Ayudante General",
      "Dibujante",
      "Electrico",
      "Electromecanico",
      "Electronico",
      "Mecanico",
      "Pailero",
      "Soldador",
      "Supervisor",
      "Supervisor de Seguridad"
    ]
  }
}
```

### 2.4 GET /api/public/catalogo/ciudades

**Si hay vacantes abiertas, solo retorna ciudades con vacantes.** Si no hay, retorna la lista completa.

**Response:**
```json
{
  "ok": true,
  "data": {
    "ciudades": ["Monterrey", "Saltillo", "Monclova"]
  }
}
```

---

## 3. POST /api/public/postulaciones

**El endpoint principal.** Envia la postulacion completa.

### Campos del body

| Campo | Tipo | Obligatorio | Descripcion |
|-------|------|:-----------:|-------------|
| `nombre` | string | **Si** | Nombre (1-200 chars) |
| `apellido_paterno` | string | No | Apellido paterno (max 200) |
| `apellido_materno` | string | No | Apellido materno (max 200) |
| `telefono_e164` | string | **Si** | Telefono movil mexicano. Acepta: `+528112345678`, `+5218112345678`, `8112345678` (10 digitos). El backend lo normaliza a E.164 |
| `email` | string | No | Email valido (max 300) |
| `municipio` | string | No | Municipio donde vive (max 100) |
| `ciudad_interes` | string | No | Una de: `"Monterrey"`, `"Saltillo"`, `"Monclova"` |
| `puesto_interes` | string | No | Una de las categorias del catalogo, o `null` si elige "Otro" |
| `puesto_interes_otro` | string | No | Texto libre (max 200). Enviar solo si `puesto_interes` es null |
| `experiencia_anios` | string | No | `"sin_experiencia"` \| `"menos_1"` \| `"1_3"` \| `"3_mas"` |
| `disponibilidad_turno` | string[] | No | Array de: `"1er_turno"`, `"2do_turno"`, `"3er_turno"`, `"rolado"`, `"fin_de_semana"`, `"cualquiera"` |
| `disponibilidad_inicio` | string | No | `"inmediata"` \| `"1_semana"` \| `"2_semanas"` \| `"1_mes"` |
| `experiencia_clientes` | array | No | Ver seccion 4 |
| `fuente` | string | No | Valor de `utm_source` de la URL (max 100) |
| `utm_medium` | string | No | Valor de `utm_medium` de la URL (max 100) |
| `utm_campaign` | string | No | Valor de `utm_campaign` de la URL (max 200) |
| `vacante_id` | string (UUID) | No | ID de la vacante seleccionada. Si el usuario elige una card de vacante, enviar su `id`. Si no, omitir |
| `website` | string | No | **HONEYPOT** — debe enviarse siempre como `""` (ver seccion 7) |

### Ejemplo request completo

```javascript
const response = await fetch('https://api.ejemplo.com/api/public/postulaciones', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombre: 'Juan',
    apellido_paterno: 'Garcia',
    apellido_materno: 'Lopez',
    telefono_e164: '8112345678',
    municipio: 'Apodaca',
    ciudad_interes: 'Monterrey',
    puesto_interes: 'Soldador',
    vacante_id: 'uuid-vacante-1',  // opcional — si eligio una card de vacante
    experiencia_anios: '1_3',
    disponibilidad_turno: ['1er_turno', '2do_turno'],
    disponibilidad_inicio: 'inmediata',
    experiencia_clientes: [
      { cliente_id: 'uuid-nemak', tipo: 'externa' }
    ],
    fuente: 'facebook',
    utm_medium: 'social',
    utm_campaign: 'soldadores_mty_mar2026',
    website: ''
  })
});
```

### Response exitosa (201)

```json
{
  "ok": true,
  "data": {
    "id": "uuid-de-la-postulacion",
    "message": "Postulacion recibida exitosamente"
  }
}
```

### Errores posibles

| HTTP | Codigo | Causa | Que mostrar al usuario |
|------|--------|-------|------------------------|
| 409 | `CONFLICT` | Ya existe postulacion con ese telefono | "Ya tienes una postulacion activa. Te contactaremos pronto." |
| 422 | `VALIDATION_ERROR` | Campos invalidos | Mostrar el detalle del error por campo |
| 429 | `RATE_LIMIT_EXCEEDED` | Mas de 5 envios por minuto desde la misma IP | "Demasiados intentos. Espera un momento e intenta de nuevo." |

**Ejemplo error 422:**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "path": ["telefono_e164"], "message": "Numero de telefono movil mexicano invalido" }
    ]
  }
}
```

---

## 4. Experiencia con clientes — como implementar

Esta seccion reemplaza la pregunta especifica "Has trabajado en Nemak?" por una version generica que se adapta automaticamente a los clientes del sistema.

### Flujo UI sugerido

1. Al cargar el formulario, llamar `GET /api/public/catalogo/clientes`
2. Mostrar la pregunta: **"Has trabajado en alguna de estas empresas?"**
3. Mostrar un checkbox por cada cliente:
   ```
   [ ] NEMAK
   [ ] Ironcast
   [ ] SRI
   ```
4. Cuando el usuario marca un checkbox, mostrar una sub-pregunta:
   ```
   [x] NEMAK
       Fue:  (o) Directamente con la empresa
             (o) Con otra compania (outsourcing/subcontratacion)
   ```
5. Construir el array `experiencia_clientes` con los seleccionados:
   ```json
   [
     { "cliente_id": "uuid-nemak", "tipo": "externa" },
     { "cliente_id": "uuid-ironcast", "tipo": "directa" }
   ]
   ```

Si el usuario no marca ninguno, enviar `[]` o no enviar el campo.

---

## 5. Captura de UTM — tracking de fuente

El formulario debe leer los parametros UTM de la URL y enviarlos en el body. Esto permite a RH saber de que canal vino cada postulacion.

### Implementacion

```javascript
// Al cargar la pagina, extraer UTMs
const params = new URLSearchParams(window.location.search);
const utmData = {
  fuente: params.get('utm_source') || null,
  utm_medium: params.get('utm_medium') || null,
  utm_campaign: params.get('utm_campaign') || null,
};

// Al enviar, incluirlos en el body
const body = {
  nombre: formData.nombre,
  telefono_e164: formData.telefono,
  // ... demas campos del formulario ...
  ...utmData,
  website: ''  // honeypot
};
```

### Ejemplos de URLs con UTM

```
https://postulate.ejemplo.com/?utm_source=facebook&utm_medium=social&utm_campaign=soldadores_mty_mar2026
https://postulate.ejemplo.com/?utm_source=whatsapp&utm_medium=referral
https://postulate.ejemplo.com/?utm_source=volante&utm_medium=print&utm_campaign=feria_empleo_saltillo
```

**El candidato no ve los UTM.** Se capturan de forma transparente.

---

## 6. Validacion de telefono

El backend acepta varios formatos y normaliza automaticamente:

| Entrada del usuario | El backend lo guarda como |
|---------------------|--------------------------|
| `8112345678` | `+528112345678` |
| `528112345678` | `+528112345678` |
| `+528112345678` | `+528112345678` |
| `+5218112345678` | `+528112345678` |

**Validacion frontend recomendada:** verificar que tenga 10 digitos (si solo ponen el numero local) o que empiece con `+52`. No necesitan normalizar — el backend lo hace.

**Errores comunes:**
- Numeros fijos (no moviles): el backend los rechaza
- Numeros con menos de 10 digitos
- Numeros de otros paises

---

## 7. Honeypot anti-spam

El formulario debe incluir un campo oculto llamado `website` que siempre se envia vacio. Los bots tienden a llenarlo automaticamente.

### Implementacion

```html
<!-- Campo oculto — NO usar type="hidden", usar CSS -->
<div style="position: absolute; left: -9999px;" aria-hidden="true">
  <label for="website">No llenes este campo</label>
  <input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
</div>
```

```javascript
// Al enviar, incluir el valor (debe ser "")
const body = {
  // ... campos visibles ...
  website: document.getElementById('website').value  // Debe ser ""
};
```

**Importante:** usar CSS para ocultar, no `type="hidden"`. Los bots detectan `type="hidden"` y no lo llenan, pero si llenan campos visualmente ocultos con CSS.

Si un bot llena el campo, el backend responde con 201 fake (para no alertar al bot) pero **no guarda nada** en la base de datos.

---

## 8. Rate limiting

El endpoint de postulaciones tiene un limite de **5 requests por minuto por IP**.

El backend devuelve headers en cada respuesta:

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1711817400
```

Si se excede: HTTP 429 con body:
```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Demasiadas solicitudes, intente nuevamente en un momento",
    "details": {
      "limit": 5,
      "window": "60s",
      "retry_after": 45
    }
  }
}
```

**Recomendacion:** deshabilitar el boton de envio despues del primer click para prevenir doble-submit accidental.

---

## 9. Diseno del formulario sugerido

### Estructura de secciones

```
=== POSTULATE ===

Seccion 0: Vacantes disponibles (NUEVO)
  - Cards de vacantes abiertas (si existen)
  - Cada card: puesto + cliente + ciudad + descripcion breve
  - Al seleccionar una card, se pre-llenan ciudad_interes y puesto_interes
  - Opcion "No veo mi puesto — postularme sin vacante especifica"

Seccion 1: Datos personales
  - Nombre *
  - Apellido paterno
  - Apellido materno
  - Telefono (WhatsApp) *
  - Email

Seccion 2: Ubicacion
  - Municipio donde vives
  - Ciudad donde quieres trabajar  [dropdown, pre-llenado si eligio vacante]

Seccion 3: Interes laboral
  - Puesto de interes  [dropdown + opcion "Otro", pre-llenado si eligio vacante]
  - Experiencia en el puesto  [dropdown]

Seccion 4: Disponibilidad
  - Turno disponible  [checkboxes, seleccion multiple]
  - Cuando puedes iniciar  [dropdown]

Seccion 5: Experiencia previa en NEMAK (opcional)
  - Has trabajado en NEMAK?  [checkbox]
    - Fue: Directamente o por empresa externa?  [radio]

[ENVIAR POSTULACION]
```

### Labels para los dropdowns

**Experiencia en el puesto:**
```
Sin experiencia
Menos de 1 ano
1 a 3 anos
Mas de 3 anos
```

**Turno disponible (checkboxes):**
```
[ ] 1er turno (manana)
[ ] 2do turno (tarde)
[ ] 3er turno (noche)
[ ] Turno rolado
[ ] Fines de semana
[ ] Cualquier turno
```

**Cuando puedes iniciar:**
```
De inmediato
En 1 semana
En 2 semanas
En 1 mes
```

### Pagina de confirmacion

Despues de enviar exitosamente, mostrar:

```
Gracias, [Nombre]!

Tu postulacion fue recibida. Nuestro equipo la revisara
y te contactaremos por WhatsApp al [telefono].

Mientras tanto, ten a la mano:
- INE vigente
- CURP
- Comprobante de domicilio
```

---

## 10. CORS

La landing page estara en un dominio separado del backend. El equipo de backend necesitara agregar el dominio de la landing page a la lista de origenes permitidos en CORS.

**Cuando tengan el dominio definido, comunicarlo al backend para que lo agreguen.**

Mientras tanto, para desarrollo local, se puede usar `localhost:5173` o `localhost:3001` que ya estan permitidos.

---

## 11. Checklist de implementacion

- [ ] Cargar vacantes al montar (`GET /api/public/vacantes`), usar filtros derivados para dropdowns
- [ ] Fallback a catalogos individuales si no hay vacantes abiertas
- [ ] Mostrar cards de vacantes con puesto, cliente, ciudad y descripcion
- [ ] Enviar `vacante_id` en el body si el usuario selecciono una card de vacante
- [ ] Capturar UTM params de la URL al cargar
- [ ] Implementar campo honeypot oculto con CSS
- [ ] Validar telefono en frontend (10 digitos minimo)
- [ ] Deshabilitar boton de envio despues del primer click
- [ ] Manejar error 409 (postulacion duplicada) con mensaje amigable
- [ ] Manejar error 429 (rate limit) con mensaje de espera
- [ ] Mostrar errores de validacion por campo (422)
- [ ] Pagina de confirmacion post-envio
- [ ] Probar en: Chrome Android, Samsung Internet, WhatsApp in-app browser
- [ ] Verificar peso total de la pagina (objetivo: < 200 KB)
- [ ] Comunicar dominio final al equipo de backend para CORS
