# Pendientes por revisar con backend

Cambios del frontend (bottom-sheet de vacante + confirmación enriquecida) que dependen de datos del backend. Eliminar este archivo cuando todos los puntos queden cerrados.

## 1. Folio en respuesta de `POST /api/public/postulaciones`

**Qué espera el frontend:** la respuesta exitosa debe incluir un identificador que el candidato pueda citar si llama a dar seguimiento.

```json
{ "ok": true, "data": { "folio": "GNC-2847" } }
```

El frontend lee `body.data.folio || body.data.id` y lo muestra en un card destacado. Si solo existe `id` (UUID), se muestra el primer segmento en mayúsculas (ej. `A3F7B2C1`) — funcional pero menos cómodo para dictar por teléfono.

**Acción:** confirmar si el backend ya devuelve `folio` o `id`. Si no devuelve ninguno, pedir que se agregue un folio corto y legible (prefijo `GNC-` + 4-6 chars, p. ej. secuencial o hash corto). Referencia en código: `src/main.js` → `showConfirmation` + `formatFolio`.

## 2. Campos adicionales del DTO de vacantes (opcional)

El bottom-sheet de detalle muestra únicamente `descripcion_publica` en una sección "Detalles del puesto". El layout está preparado para recibir más campos si el backend los expone (horario, requisitos, prestaciones, salario, etc.).

**Acción:** si el negocio quiere separar secciones, pedir al backend que divida la información en campos estructurados (p. ej. `horario`, `requisitos`, `prestaciones`) en vez de un bloque único. Baja prioridad — el rendering actual ya funciona con `whitespace-pre-wrap`.

## 3. Número de contacto de fallback (no backend, operativo)

`VITE_CONTACT_WHATSAPP` en `.env` define el WhatsApp al que el candidato escribe si no recibe respuesta en 3 días. Si la variable está vacía, la card de fallback no se muestra.

**Acción:** definir con operaciones qué número usar. Actualmente `.env.example` tiene un placeholder (`+52 81 1234 5678`) que hay que reemplazar en el `.env` real antes de deploy.
