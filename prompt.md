# Backend → Frontend: nuevo módulo planificado (Colaboradores + QR + convocatorias)

Todavía **no está implementado** — el fundador pidió planificarlo bien antes de tocar código, así que esto es el contrato propuesto para que lo revisen de su lado en paralelo. El plan completo (modelo de datos, endpoints, WhatsApp/email, anti-abuso) está en [`docs/colaboradores-qr.md`](./docs/colaboradores-qr.md) del repo del backend. Acá el resumen de lo que les va a tocar a ustedes.

## Qué es

El pastor genera un QR propio de su iglesia. La gente lo escanea, cae en una landing pública (sin login) que muestra el logo de la iglesia + nombre del pastor, y deja nombre/apellido/email/teléfono. Cuando se organiza un culto, alguien del equipo aprieta un botón "Convocar" en el evento y les llega WhatsApp + email a todos los colaboradores activos de esa iglesia.

Dos decisiones ya tomadas con el fundador:
- WhatsApp va por la **API oficial de Meta Cloud API** (no librerías no oficiales) — más trámite, cero riesgo de que baneen el número.
- La convocatoria **nunca es automática** — siempre es un botón explícito en el evento.

## Endpoints que van a consumir (contrato propuesto, todavía no implementado)

Públicos, sin auth:
- `GET /public/colaboradores/:qrToken` → `{ iglesiaNombre, iglesiaLogoUrl, pastorNombre }` (404 si el token no existe)
- `POST /public/colaboradores/:qrToken` → body `{ nombre, apellido, email, telefono, aceptaConsentimiento: true }`
- `POST /public/colaboradores/baja/:bajaToken` → sin body, da de baja

Autenticados:
- `GET /colaboradores`, `PATCH /colaboradores/:id`, `DELETE /colaboradores/:id`
- `GET /iglesias/mi-iglesia/qr` → `{ qrToken, url }`
- `POST /iglesias/mi-iglesia/qr/regenerar`
- `POST /agenda/eventos/:id/convocar` → responde resumen parcial: `{ destinatarios, whatsapp: { enviados, fallidos }, email: { enviados, fallidos } }`

## Lo que necesito que planifiquen de su lado

1. **`/colaboradores/registro/[qrToken]`** — página pública, mobile-first (la mayoría va a entrar desde la cámara del celular escaneando el QR). Logo + nombre iglesia + "Pastor: X" + formulario + checkbox de consentimiento. Pantalla de confirmación simple al enviar, sin distinguir "ya estabas registrado" de "nuevo" (por privacidad, no hace falta filtrar esa info).
2. **`/colaboradores/baja/[bajaToken]`** — página pública mínima, confirmar y listo.
3. **Panel admin "Colaboradores"** dentro del dashboard: listado + búsqueda + acciones, y una vista de QR que lo **genere del lado del cliente** (librería tipo `qrcode`, no hace falta que el backend mande una imagen) a partir de la URL pública que les devuelve `GET /iglesias/mi-iglesia/qr`, con botón de descarga para imprimir y botón de regenerar (con confirmación, porque invalida el QR impreso anterior).
4. **Botón "Convocar a colaboradores"** en el detalle de un evento — mostrar cuántos destinatarios activos hay antes de confirmar, y al volver mostrar el resumen parcial (ej. "42/45 WhatsApp, 45/45 email"), no un toast de éxito genérico, porque el envío masivo falla parcialmente por diseño.

## Fases (para que no bloqueen todo a la vez)

1. Colaboradores + QR + registro + admin CRUD, sin canales de notificación aún.
2. Convocatoria por email.
3. WhatsApp (depende de un trámite externo con Meta que tiene demora — probablemente lo último en estar listo).

Avísenme si el criterio de roles que propuse (`PASTOR` + `SECRETARIA` pueden gestionar colaboradores) les hace sentido de su lado, o si necesitan que `TESORERO` también tenga acceso.
