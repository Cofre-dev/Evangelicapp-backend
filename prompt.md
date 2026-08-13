# Brief para frontend: Realtime (Fase 5 de docs/supabase.md) — dashboard SuperAdmin, evento del Pastor y censo en vivo

## Resumen

Implementé el canal de WebSocket para las 3 pantallas que "se sienten vivas sin refrescar" que
planteaba la Fase 5 del plan de Supabase. Una aclaración importante antes de los contratos:
**esto NO es Supabase Realtime nativo** (`supabase-js` + `.channel(...).on('postgres_changes', ...)`).
El doc original lo planteaba así, pero eso transmite a cualquier cliente con la anon key
pública salvo que RLS esté activo filtrando fila por fila — y RLS (Fase 8) todavía no existe.
Prenderlo hoy habría expuesto eventos/integrantes de cualquier iglesia a cualquier cliente, así
que en su lugar implementé un WebSocket propio en el backend (Socket.IO sobre NestJS),
autenticado con el mismo `access_token` que ya usan para todo lo demás. Para ustedes el efecto
práctico es el mismo (eventos en vivo por pantalla) pero la librería a usar es `socket.io-client`,
no `supabase-js`, y no hay ningún concepto de Supabase de por medio.

Como siempre, solo tengo acceso a `frontend/src/app/agenda/asistencia` de su repo — las 3
pantallas de este brief viven en el dashboard del SuperAdmin, en la pantalla de detalle de
evento del Pastor y en la pantalla de censo/QR, así que no pude implementar el lado cliente.

---

## 1. Cómo conectar

```
npm install socket.io-client
```

```ts
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_API_URL, {
  withCredentials: true, // manda la cookie access_token igual que sus fetch actuales
});
```

- **Mismo host/puerto que la API REST**, no hace falta una URL ni un puerto distinto — el
  gateway cuelga del mismo servidor Nest.
- **Autenticación**: automática vía la cookie httpOnly `access_token` que ya tienen (mismo
  mecanismo que cualquier request con `credentials: 'include'`). No hace falta pasar ningún
  token a mano. Si por lo que sea `withCredentials` no manda la cookie en su setup (algunos
  proxies/entornos), hay un fallback: `io(url, { auth: { token: elAccessToken } })` — pero
  primero prueben con la cookie, que es el mismo patrón que ya usan en todos lados.
- **Si no hay sesión válida (sin cookie, o vencida), el servidor corta la conexión de
  inmediato** (`disconnect` con reason `io server disconnect`) — no hace falta que ustedes
  verifiquen nada antes de conectar, el servidor rechaza solo.
- **El access token dura 15 minutos** (como el resto de la API). Si el socket se desconecta a
  mitad de sesión, la causa más probable es que el token expiró. Socket.IO reconecta solo por
  defecto (`reconnection: true`), pero reconectará con la MISMA cookie vieja si no se refrescó
  — les conviene reconectar el socket (`socket.disconnect(); socket.connect();`) después de
  cada `POST /auth/refresh` exitoso, igual que ya deben estar renovando sesión hoy.
- **No hay nada que filtrar del lado del cliente.** El servidor decide a qué "room" pertenece
  cada conexión según el rol/iglesia del JWT — un socket de la iglesia A nunca recibe eventos
  de la iglesia B, y esto lo garantiza el backend, no ustedes. Solo tienen que escuchar los
  eventos de abajo.

---

## 2. Dashboard SuperAdmin — evento `iglesia:actualizada`

Se dispara cada vez que cambia el estado o la facturación de **cualquier** iglesia (confirmar
pago, ocultar/mostrar, corregir fecha de facturación). Mismo shape que un item de
`GET /iglesias` — pueden usarlo para parchear la fila en la tabla sin volver a pedir la lista
completa.

```json
{
  "id": "igl_demo",
  "nombre": "Iglesia Evangélica Demo",
  "comuna": "Ñuñoa",
  "region": "Metropolitana",
  "logoUrl": null,
  "estado": "ACTIVA",
  "plan": "BASICO",
  "createdAt": "2026-07-12T00:32:10.519Z",
  "pastor": { "nombre": "Juan", "apellido": "Pérez", "email": "pastor@demo.cl" },
  "facturacion": {
    "proximaFacturacion": "2026-10-07T00:00:00.000Z",
    "diasParaFacturacion": 55,
    "color": "VERDE",
    "enMora": false,
    "diasEnMora": 0,
    "puedeOcultar": false
  }
}
```

Sugerencia: en la tabla de "Iglesias" y en el landing con KPIs, escuchen este evento y hagan
`setState` sobre la fila con ese `id` (agregarla si no estaba, ej. iglesia recién creada no
aplica porque `create` no emite este evento — solo las 4 acciones que cambian estado/facturación
de una ya existente).

---

## 3. Evento del Pastor — evento `predicador:respondio`

Se dispara cuando un predicador confirma o rechaza desde el link del email (`GET /agenda/predicadores/:token`,
público, fuera de su control). Solo llega a los sockets conectados con un usuario de la MISMA
iglesia del evento.

```json
{
  "eventoId": "cmss0mpzk000l6zmideer3oj9",
  "predicadorId": "cmss0mpzw000n6zmiix24bot2",
  "nombre": "Predicador Smoke",
  "email": "predicador-smoke@example.com",
  "estado": "CONFIRMADO",
  "respondidoAt": "2026-08-13T21:13:49.387Z"
}
```

`estado` es `"CONFIRMADO"` o `"RECHAZADO"`. Sugerencia: en la pantalla de detalle de un evento,
si `eventoId` coincide con el evento abierto, actualicen el badge de ese predicador sin
recargar (mismos campos que ya trae `predicadores` en `GET /agenda/eventos/:id`).

---

## 4. Censo en vivo — evento `integrante:registrado`

Se dispara cuando alguien completa el formulario público del QR (`POST /integrantes/registro/:qrToken`)
y es un integrante NUEVO — si la persona ya existía (mismo email o RUN), no se emite nada (no
hay "nueva fila" que mostrar). Solo llega a los sockets conectados con un usuario de esa
iglesia.

```json
{
  "id": "cmss0mqnn000p6zmi4fglckd9",
  "nombreCompleto": "Integrante Smoke Test",
  "fotoUrl": null,
  "miembroDesde": "2020-01-01T00:00:00.000Z"
}
```

Sugerencia: en la pantalla que abren para ver el QR durante un evento, escuchen este evento y
agreguen la fila a la lista de "recién censados" a medida que entra gente — ideal para
proyectar en pantalla durante el evento.

---

## 5. Ejemplo mínimo end-to-end

```ts
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_API_URL, { withCredentials: true });

// Dashboard SuperAdmin
socket.on('iglesia:actualizada', (iglesia) => {
  // patch de la fila en la tabla/estado local
});

// Evento del Pastor
socket.on('predicador:respondio', (payload) => {
  // solo aplica si payload.eventoId === eventoAbiertoId
});

// Censo en vivo
socket.on('integrante:registrado', (integrante) => {
  // push a la lista de recién censados
});

// al desmontar la pantalla
socket.disconnect();
```

Un mismo socket puede escuchar los 3 eventos a la vez (no hace falta abrir 3 conexiones) —
simplemente cada pantalla se suscribe solo al evento que le interesa y lo ignora en las demás
rutas.

---

## Resumen de lo que NO cambió

- Ningún endpoint REST nuevo ni cambio de contrato en los existentes — el WebSocket es un canal
  adicional, no un reemplazo. `GET /iglesias`, `GET /agenda/eventos/:id`, `GET /integrantes`
  siguen funcionando exactamente igual para la carga inicial de cada pantalla; el socket solo
  aporta las actualizaciones en vivo después de esa carga inicial.
- No hay nada de Supabase involucrado (ni `supabase-js`, ni anon key, ni RLS) — es
  `socket.io-client` puro contra el propio backend.
- La autenticación es la misma cookie de siempre — no hay un login ni un token separado para el
  socket.
