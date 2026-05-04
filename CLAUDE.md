# CLAUDE.md — Postulaciones GAINCO (formulario público)

## Qué es este proyecto

Landing/formulario público de postulación para candidatos externos. **Vanilla JavaScript + Vite + Tailwind CSS v4** (sin framework). Es la app más simple del suite: una sola página con un formulario que envía a `POST /api/public/postulaciones` del backend.

URL en producción: `empleos.gainco.mx`. Es el primer punto de contacto del candidato — alimenta el funnel que continúa en `rh-worker-management-frontend` (pipeline de candidatos).

> Workspace padre: ver `../CLAUDE.md` (`gainco-suite`) para mapa de repos, convenciones cruzadas y la regla "commits por sub-repo".

## Comandos

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Build a dist/
npm run preview      # Preview del build
npm start            # Sirve dist/ con `serve` en $PORT (default 3000) — para Railway
```

No hay tests ni linter configurado. No hay TypeScript.

## Stack

- **Vanilla JS (ES2020)** — `src/main.js`, `src/validation.js`, `src/style.css`
- **Vite 7** como bundler
- **Tailwind CSS v4** vía `@tailwindcss/vite` (tokens definidos inline en `style.css`)
- **`serve`** para servir el build en runtime (Railway)
- Sin React, sin router, sin state manager — es intencional (página simple, fast time-to-interactive, baja complejidad)

## Variables de entorno

```bash
# .env (no commitear; ya está en .gitignore)
VITE_API_BASE=https://<backend-host>             # ej. https://api.gainco.mx
VITE_CONTACT_WHATSAPP=+52 81 XXXX XXXX            # número fallback que ve el candidato si no hay respuesta en 3 días
```

`.env.example` está commiteado con valores de referencia. Si `VITE_CONTACT_WHATSAPP` está vacío, la card de fallback no se renderiza.

## Despliegue

- **Railway** (`railway.json`): build con `npm run build`, start con `npm start` (sirve `dist/` con `serve`).
- **Vercel** (`vercel.json`): rewrites para SPA + cache headers para `/assets/*`.

Ambos coexisten — actualmente activo en uno de los dos. Confirmar con operaciones cuál es el de producción antes de cambiar configs de deploy.

## Estructura del código

- `index.html` — HTML completo del formulario (sin framework, todo el markup vive aquí)
- `src/main.js` — orquestador: carga catálogos, monta listeners, envía formulario, muestra confirmación, captura UTMs
- `src/validation.js` — `validateForm(data)` puro, retorna `{ valid, errors }`. Reglas: nombre 1-200, teléfono 10 dígitos o `+52`, email opcional pero válido si se da, etc.
- `src/style.css` — estilos custom + directivas Tailwind v4

## Endpoints públicos del backend que consume

- `GET /api/public/vacantes` — lista de vacantes activas
- `GET /api/public/catalogo/clientes` — clientes/plantas
- `GET /api/public/catalogo/ciudades` — ciudades
- `GET /api/public/catalogo/categorias` — categorías de puesto
- `POST /api/public/postulaciones` — submit del formulario

Todos son **públicos** (sin JWT). El backend valida y guarda en `postulaciones`.

## Convenciones del código

- **Idioma de UI**: español MX, mantener tildes y `ñ`.
- **Teléfono**: capturar 10 dígitos locales o `+52XXXXXXXXXX`. El backend normaliza prefijo WhatsApp `+521`.
- **Captura de UTMs**: `utm_source`/`fuente`, `utm_medium`, `utm_campaign` se leen de query string al cargar la página y se envían con la postulación. No remover.
- **Folio en confirmación**: la respuesta lee `body.data.folio || body.data.id`. Si el backend agrega un folio corto y legible, se muestra en el card de confirmación. Ver `PENDIENTES_BACKEND.md` (raíz del repo) para el roadmap pendiente.
- **Bottom-sheet de vacante**: detalle expandido al tocar una vacante en mobile. Acepta `descripcion_publica` (texto libre con `whitespace-pre-wrap`).
- **Sin React**: no agregar React/Vue/Svelte. Si una feature pide más complejidad, evaluar primero si se puede resolver con vanilla + Web Components antes de migrar el stack.

## Reglas críticas

- **Sin auth** — endpoints públicos del backend. NO agregar lógica que asuma usuario logueado.
- **Sin secretos en el bundle** — `VITE_*` se exponen al cliente. Nunca poner API keys privadas como `VITE_*`.
- **No commitear `.env`** — ya está en `.gitignore`. Usar `.env.example` para referencia.
- **No commitear `.claude/settings.local.json`** — ya está en `.gitignore`.
- **No commitear screenshots `*.png`** — ya está en `.gitignore` (capturas de prueba locales).

## Documentos relevantes en este repo

- `GUIA_FRONTEND_FORMULARIO_POSTULACION_PUBLICA.md` — guía completa del formulario
- `PENDIENTES_BACKEND.md` — pendientes que dependen del backend (folio, campos extra de vacante, número de fallback)
