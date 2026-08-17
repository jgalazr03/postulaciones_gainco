# CLAUDE.md — Postulaciones GAINCO (formulario público)

## Qué es este proyecto

Sitio público de GAINCO. **Vanilla JavaScript + Vite + Tailwind CSS v4** (sin framework). Es la app más simple del suite y, desde agosto de 2026, es **multi-página**: dos productos distintos que comparten dominio y deploy, no una SPA con rutas (no hay router de cliente y nunca lo hubo).

| Página | URL | Para quién | Estado |
|---|---|---|---|
| `index.html` | `empleos.gainco.mx` | Candidato externo | ⏸️ **En pausa** (`POSTULACIONES_PAUSADAS`) |
| `apoyo-escolar.html` | `empleos.gainco.mx/apoyo-escolar` | **Trabajador ya contratado** | ✅ Activa |

El formulario de postulación es el primer punto de contacto del candidato y alimenta el funnel que continúa en `rh-worker-management-frontend`. El registro de apoyo escolar es un trámite interno de RH que casualmente vive aquí: es la única superficie pública del suite, y montarlo aquí evita un repo y un deploy nuevos.

> ⚠️ **Dos sistemas de diseño coexisten en este repo, a propósito.** No unificarlos sin leer la sección "Dos sistemas de diseño".

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

- **Vanilla JS (ES2020)** — sin React, sin router, sin state manager. Intencional.
- **Vite 7** como bundler, en modo **multi-página** (`build.rollupOptions.input` en `vite.config.js`). Cada HTML de la raíz es una entrada; agregar una página nueva = agregar su entrada ahí, o Vite no la compila.
- **Tailwind CSS v4** vía `@tailwindcss/vite` — sólo lo usa `index.html`.
- **`@fontsource-variable/roboto-flex`** — tipografía de Android, self-hosted; sólo la usa `apoyo-escolar.html`.
- **`serve`** para servir el build en runtime (Railway).

## Dos sistemas de diseño

Cada página tiene el suyo y **no deben unificarse**:

- **`src/style.css`** (postulación) — tokens propios, tipografía Outfit. Los comentarios dicen «Material M3 surfaces» pero los valores están elegidos a mano: es un parecido a M3, no el sistema.
- **`src/apoyo-escolar.css`** (apoyo escolar) — **M3 de verdad**. El esquema completo lo generó el algoritmo oficial de Google (`@material/material-color-utilities`, `SchemeTonalSpot`, semilla `#004979` = azul GAINCO), que es el mismo cálculo que corre Android para Material You. Ningún color está elegido a ojo. Tipografía Roboto Flex.

El motivo de la fidelidad no es estético: quien llena el apoyo escolar es un trabajador de planta con poco manejo de tecnología y un Android en la mano, y los componentes que ya toca a diario no le exigen aprender nada nuevo.

**El rojo de marca (`#b60f21`) NUNCA es color de acción ni de estado** en la página de apoyos: es casi idéntico al rol `error` de M3 (`#ba1a1a`) y en un botón leería «peligro» donde dice «continuar». Vive sólo en la franja superior de identidad — que además es la señal de que el link no es una estafa, algo que importa cuando se piden actas de nacimiento por WhatsApp.

Para regenerar el esquema si cambia el color semilla, la librería está instalada en `rh-worker-management-frontend`:

```bash
cd ../rh-worker-management-frontend && node --input-type=module -e "
const { Hct, SchemeTonalSpot, MaterialDynamicColors: M, argbFromHex, hexFromArgb } = await import('@material/material-color-utilities');
const s = new SchemeTonalSpot(Hct.fromInt(argbFromHex('#004979')), false, 0);
console.log(hexFromArgb(M.primary.getArgb(s)));
"
```

## Variables de entorno

```bash
# .env (no commitear; ya está en .gitignore)
VITE_API_BASE=https://<backend-host>             # ej. https://api.gainco.mx
VITE_CONTACT_WHATSAPP=+52 81 XXXX XXXX            # número fallback que ve el candidato si no hay respuesta en 3 días
```

`.env.example` está commiteado con valores de referencia. Si `VITE_CONTACT_WHATSAPP` está vacío, la card de fallback no se renderiza.

## Despliegue

**Producción es Railway** (verificado por header `server: railway-hikari` en `empleos.gainco.mx`). Auto-deploy al pushear `main`. `vercel.json` sigue en el repo como config alterna.

### 🚨 El sitio NO se sirve en modo SPA — y no debe volver a hacerlo

`npm start` es `serve dist` **sin `-s`**. Con `-s` (o con un rewrite `/(.*) → /index.html`), `serve-handler` aplica el rewrite **antes** de intentar resolver el archivo real (`src/index.js`: si hay `rewrittenPath`, `possible = [rewrittenPath]` y ya no prueba `apoyo-escolar.html`). Resultado: **`/apoyo-escolar` serviría el formulario de postulación pausado**, no la página de apoyos.

Por la misma razón `vercel.json` ya no lleva `rewrites`; lleva `cleanUrls: true`.

El sitio no usa `pushState` ni hash routing, así que el modo SPA nunca hizo falta. Comportamiento correcto, verificable con `npm run build && PORT=4178 npm start`:

| Ruta | Debe servir |
|---|---|
| `/` | `index.html` (postulación) |
| `/apoyo-escolar` | `apoyo-escolar.html` |
| cualquier otra | **404** (antes devolvía 200 con el index) |

## Estructura del código

**Postulación** (en pausa):
- `index.html` — markup completo del formulario
- `src/main.js` — orquestador: catálogos, listeners, envío, confirmación, UTMs
- `src/validation.js` — `validateForm(data)` puro → `{ valid, errors }`
- `src/style.css` — estilos + Tailwind v4

**Apoyo escolar**:
- `apoyo-escolar.html` — markup de todas las vistas + `<template>` para los bloques repetibles (hijo, tarjeta de documentos, renglón de subida)
- `src/apoyo-escolar.js` — máquina de 3 pasos, subida de fotos, acuse y pantalla de regreso
- `src/apoyo-escolar.css` — M3 (ver "Dos sistemas de diseño")

### Decisiones del flujo de apoyo escolar (no revertir sin leer)

- **La solicitud se crea al terminar el PASO 2, no al final.** El censo —quién tiene cuántos hijos estudiando— es el dato que RH necesita para dimensionar el apoyo, y los papeles pueden llegar después. Si la creación esperara al último botón, quien se atora subiendo fotos (el escenario más probable con esta población) no quedaría registrado. Por eso el paso 3 no tiene «Regresar»: los datos ya se enviaron.
- **El acuse tiene dos caras y sólo la verde dice «ya no tienes que hacer nada más».** La ámbar nombra al hijo y el documento que falta («de Sofía falta el acta»), nunca un conteo: un número no le dice a nadie qué tiene que hacer. Es la defensa contra que el trabajador crea que ya terminó y luego espere un apoyo que no va a llegar.
- **Pasos numerados siempre visibles** — misma razón: cuesta creer que acabaste cuando la pantalla dice «Paso 2 de 3».
- **Las fotos se comprimen en el navegador antes de subir** (1600 px, JPEG 0.75). Un celular de gama baja saca 7 MB y con la red de una planta esa subida se cae. Si la compresión no mejora el tamaño, se manda el original.
- **`capture="environment"`** para que el botón abra la cámara, no un explorador de archivos.
- **Borrador en `localStorage`** mientras captura, y el token guardado después: quien ya se registró desde ese celular vuelve a SU trámite, no a uno nuevo.
- **El backend nunca confirma si un número de acceso existe.** Si lo hiciera, el endpoint sería un oráculo para enumerar quién trabaja en GAINCO. El trabajador escribe texto libre y RH concilia después contra la nómina.
- **`mostrarSolicitud()` es la ÚNICA que decide qué pantalla toca.** Ninguna vista se elige a mano. Antes cada camino —link `?t=`, rescate por folio, fin de una subida— la escogía por su cuenta, y divergieron: una solicitud rechazada con los papeles completos entraba por la rama `completo` y mostraba el acuse VERDE («ya no tienes que hacer nada más») de un apoyo que no iba a llegar. El orden manda: **lo que RH decidió pesa más que el conteo de papeles** (`rechazada` → `completo` → faltantes).
- **Después de subir un documento, se reevalúa la pantalla, no se repinta un contenedor.** `subirDocumento` deriva su contexto del DOM (`data-docs-lista` = `alta` | `regreso` | `rechazo`), nunca de un id fijo. El bug que lo motivó: repintaba `#docs-lista` siempre, así que quien subía desde la pantalla de regreso repintaba un contenedor OCULTO y su renglón se quedaba en «Subiendo…» hasta recargar. En `alta` sólo repinta (el trabajador sigue en su flujo y toca «Terminar» él); en los otros dos delega en `mostrarSolicitud()`.
- **El veredicto es POR DOCUMENTO, no por solicitud** (backend mig. 178). El papel rechazado se pinta en ROJO (`is-rejected`) con el motivo que escribió RH pegado debajo; los aceptados y los que están sólo pendientes de revisión se quedan en verde, para que el trabajador no los vuelva a mandar. Antes el rechazo era de toda la solicitud y tenía que adivinar cuál de sus cuatro archivos rehacer. El chip del hijo distingue tres casos con ese orden de urgencia: **«Revisa N» (rojo) pesa más que «Faltan N» (ámbar), y ambos más que «Completo» (verde)**.
- **`is-missing` (ámbar) sólo al VOLVER, no durante el alta.** En el paso 3 todos los papeles están pendientes por definición; teñir la pantalla entera convertiría el estado normal en alarma. Al volver sí, porque entró justamente a completar.
- **El reenvío es un BOTÓN, no un efecto de subir el archivo.** Quien tiene dos hijos sube de a uno y a ratos: sin un aviso deliberado, RH revisaría expedientes a medio corregir y los rechazaría otra vez. El botón se habilita sólo cuando no queda nada en rojo, y esa regla la decide el backend (`puede_reenviar`) con el mismo criterio que aplica al recibir el reenvío — tenerla en dos sitios es garantizar que se separen.
- **NUNCA `capture` en el `<input type="file">`.** Ese atributo abre la cámara directo y deja fuera el carrete, y lo normal aquí es que el acta ya esté en el teléfono (se la mandaron por WhatsApp). Sin él, Android ofrece cámara, galería y archivos.
- **El apoyo es DINERO por transferencia** (backend mig. 179, agosto 2026). Fue crédito en papelería hasta que el dueño cambió la decisión, antes de publicar la convocatoria. Si aparece una mención a «vale» o «papelería» en esta página, es un resto: hay que quitarla.
- **La pregunta de la tarjeta BIFURCA, y quien contesta «no» sigue adelante.** La CLABE sólo se le pide a quien tiene tarjeta Santander otorgada por GAINCO; al resto se le dice explícitamente que termine su registro y que RH lo buscará. Pedirle una CLABE que no tiene lo dejaría atorado, y la de su banco no es la que contabilidad pidió. Nadie queda sin vía de pago por no traer tarjeta.
- **La CLABE NO se guarda en el borrador de `localStorage`**, sola entre todos los campos. El resto es «quién soy» y ya vivía ahí; ésta es «dónde está mi dinero», y en planta se presta el celular. Cuesta volver a teclear 18 dígitos en el caso raro de cerrar la pestaña a media captura; guardarla cuesta dejarla en un teléfono que va a pasar por otras manos.
- **El campo de CLABE va SIN `maxlength`.** Lo tuvo, y truncaba el pegado: la CLABE se copia de la app del banco con espacios («0141 8065 5043 2109 87» son 22 caracteres), el navegador cortaba a los 18 primeros y se perdían cuatro dígitos sin que nadie lo notara. El recorte lo hace el JS después de quitar los espacios.

### Compatibilidad con teléfonos de gama baja

Es un requisito, no una aspiración: quien llena esto es un trabajador de planta. Lo que fija el piso NO es la versión de Android sino la de Chrome, que en Android se actualiza solo por Play Store (un Android 8 de 2017 con Play Services corre Chrome actual).

| Lo que usa la página | Piso |
|---|---|
| `gap` en flexbox (19 usos) | **Chrome 84** ← el más alto |
| `:focus-visible` | Chrome 86 (degrada a sin outline) |
| `?.` / `??` (target `es2020`) | Chrome 80 |
| `createImageBitmap` | Chrome 50, y va dentro de `try/catch` que cae al archivo original |
| `env(safe-area-inset-*)` | degrada a 0 |

Reglas al tocar esta página: **nada de `inset:`** (Chrome 87), `:has()`, `oklch()` ni `@layer`; y `scrollTo({behavior:'instant'})` es Chrome 97 — usar `'auto'`, que hace lo mismo. El presupuesto actual es **~12.2 kB gzip** (CSS + JS propios: 4.3 + 7.8 al 2026-08-17); cualquier cosa que lo multiplique tiene que justificarse contra los segundos de pantalla en blanco que cuesta en la red de una planta. ⚠️ Esta cifra **se mide, no se hereda**: decía 9.4 kB cuando el bundle real ya iba en 11.5, porque nadie la volvió a medir tras el repaso de UX. Al tocar la página, correr `npm run build` y actualizarla aquí es parte de «terminado».

**No importar `@material/web`.** Se evaluó. Está en modo mantenimiento desde junio de 2024 (Google reasignó a sus ingenieros a Wiz; sin features nuevas, sin M3 Expressive) — mala apuesta para una página pensada para reusarse cada ciclo escolar. Además trae Lit como runtime, y sus custom elements no tienen estilo hasta que el JS los define: en gama baja esa ventana se ve, mientras que hoy el CSS pinta desde el primer frame y un fallo de JS aún deja `<input>` usables. Y no compraría fidelidad que no esté ya: el esquema lo generó el algoritmo oficial de Google y las medidas son las specs M3. Lo que sí faltaba de M3 era *comportamiento* —el state layer al tocar, el ámbar de lo pendiente— y eso se cableó en CSS, sin peso.

## Endpoints públicos del backend que consume

Todos son **públicos** (sin JWT) y llevan rate limit por IP en el backend.

**Postulación** (`index.html`):
- `GET /api/public/vacantes` — vacantes activas
- `GET /api/public/catalogo/clientes` · `/ciudades` · `/categorias`
- `POST /api/public/postulaciones` — submit del formulario

**Apoyo escolar** (`apoyo-escolar.html`, módulo `apoyos` del backend, mig. 177):
- `GET /api/public/apoyos/catalogo` — plantas y ciudades
- `GET /api/public/apoyos/:clave` — ventana del programa y qué documentos pide
- `POST /api/public/apoyos/:clave/solicitudes` — alta del registro → devuelve `folio` y `token`
- `GET /api/public/apoyos/solicitudes/:token` — estado (pantalla de regreso)
- `POST /api/public/apoyos/solicitudes/:token/documentos` — sube una foto (multipart, campo `archivo`)
- `POST /api/public/apoyos/rescate` — `folio` + `numero_acceso` → token nuevo
- `POST /api/public/apoyos/solicitudes/:token/reenviar` — el trabajador avisa que ya corrigió (mig. 178). Sólo procede si la solicitud está `rechazada` y ya no queda ningún documento en ese estado; el backend aplica la misma regla que expone en `puede_reenviar`.

⚠️ **No usar `/api/public/catalogo/clientes` para el apoyo escolar.** Ese endpoint prioriza «clientes con vacantes abiertas» y sólo cae al catálogo completo si esa lista viene vacía: con una sola vacante de NEMAK en Monterrey devuelve un cliente y una ciudad, y un trabajador de Ironcast o Saltillo no podría seleccionar su planta. Para eso existe `/api/public/apoyos/catalogo`.

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
