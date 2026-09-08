# Prompt — Migrar el tiempo real de socket.io a Supabase Realtime (frontend)

Contexto para copiar/pegar en una sesión de Claude Code sobre el repo del **frontend**
(Next.js). El backend ya hizo su parte (parallel-run): sigue emitiendo por socket.io
**y** por Supabase Broadcast a la vez, y expone el endpoint nuevo `GET /realtime/token`.
Cuando este cambio de frontend esté mergeado y verificado en staging, el backend saca
socket.io en un PR de limpieza.

Plan completo: `docs/realtime-migration.md` en el repo del backend.

---

```
Necesito reemplazar el WebSocket propio del backend (Socket.IO) por Supabase Realtime
(Broadcast) en las 3 pantallas "en vivo". Los nombres de evento y la forma de los
payloads NO cambian — solo cambia el transporte.

POR QUÉ EL CAMBIO
El backend dejó de mantener un servidor WebSocket propio stateful. Supabase Realtime ya
viene con el plan. Ojo: esto agrega `@supabase/supabase-js` al frontend SOLO para el
canal de Realtime. La API REST de negocio se sigue consumiendo igual que hoy (apiFetch,
cookies httpOnly contra el backend) — NO uses supabase-js para datos, ni para auth, ni
para storage. Solo Realtime.

CONTRATO DEL BACKEND (real, no lo inventes)

1. Endpoint nuevo:
     GET /realtime/token
   - Autenticado con la cookie de sesión actual (usa apiFetch, con credenciales).
   - Respuesta 200:
       {
         "token": "<JWT HS256 de vida corta>",
         "topic": "<string: 'superadmin' o 'tenant:<iglesiaId>'>",
         "expiresInSeconds": 1800
       }
   - El backend decide el `topic` según el rol/iglesia de la sesión. NO le mandes
     iglesiaId ni ningún parámetro — no los acepta.
   - Puede responder 503 si el entorno no tiene Realtime configurado (falta el
     secret de firma en el backend). Trátalo como "sin realtime": las pantallas
     deben seguir funcionando con su carga/refresh normal, sin romper.
   - Rate limit: 30/min por IP. Con un refresh cada ~29 min sobra de lejos.

2. El `token` sirve para autenticar la conexión de Realtime vía
   `supabase.realtime.setAuth(token)`. Expira en `expiresInSeconds`. Hay que pedir uno
   nuevo y volver a llamar `setAuth` ANTES de que expire (ej. a los expiresInSeconds - 60).
   Si el token expira, Realtime corta la conexión.

3. Canal: privado. `supabase.channel(topic, { config: { private: true } })`.
   Un solo canal por usuario (el `topic` que devolvió el endpoint). Ahí llegan todos
   los eventos que le corresponden.

4. Eventos (broadcast). En el callback de supabase-js el dato viene en `msg.payload`:
   - 'iglesia:actualizada'    -> payload = mismo shape que un item de GET /iglesias
                                 (IglesiaListItem). Solo en el topic 'superadmin'.
   - 'predicador:respondio'   -> payload = { eventoId, predicadorId, nombre, email,
                                 estado, respondidoAt }. Topic 'tenant:<iglesiaId>'.
   - 'integrante:registrado'  -> payload = { id, nombreCompleto, fotoUrl, miembroDesde }.
                                 Topic 'tenant:<iglesiaId>'.
   Son EXACTAMENTE los payloads que hoy ya maneja el código en use-socket.ts /
   evento-dialog.tsx / qr-dialog.tsx / superadmin. No cambies los tipos.

VARIABLES DE ENTORNO (nuevas, del proyecto Supabase "Backend" — el de la BD)
   NEXT_PUBLIC_SUPABASE_URL=https://lkcgiqmgdefhxhckedga.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del proyecto Backend>
   La anon key NO es secreta (es publishable). Sacala del dashboard de Supabase
   (proyecto "Backend" > Project Settings > API > anon/public) o pedila al equipo.
   Agrégalas a .env.example y a los envs de Vercel/Cloudflare (local, staging, prod).

QUÉ IMPLEMENTAR

1. `npm i @supabase/supabase-js` y `npm rm socket.io-client`.

2. Cliente Supabase singleton (ej. src/lib/supabase-realtime.ts): createClient con la
   URL y anon key de arriba. Solo se usa para `.channel()` / `.realtime`. Desactivá
   persistSession / autoRefreshToken (no hay sesión de supabase-auth acá).

3. Reemplazar src/hooks/use-socket.ts por src/hooks/use-realtime.ts. Responsabilidades:
   - Mientras haya sesión (usuarioId en el auth store), pedir GET /realtime/token,
     hacer supabase.realtime.setAuth(token), suscribir UN canal privado al `topic`.
   - Timer para re-pedir token + setAuth antes de expirar (expiresInSeconds - 60s).
   - Re-pedir token + setAuth también cuando la sesión se refresca (ya existe
     onSessionRefreshed en src/lib/api.ts — hoy lo usa use-socket para reconectar;
     adaptalo, no lo borres sin ver quién más lo escucha).
   - Si GET /realtime/token da 503 o falla, quedarse en modo "sin realtime" sin tirar
     errores en consola en loop.
   - Limpiar (unsubscribe + clear timer) al desmontar / perder sesión.
   - Exponer una API mínima para que los componentes se enganchen a un evento puntual,
     ej. `useRealtimeEvent('predicador:respondio', handler)`. Como un RealtimeChannel de
     supabase no tiene un `.off(listener)` limpio, la forma práctica es: el hook
     mantiene el canal singleton y un pequeño registro de handlers por evento, y
     `useRealtimeEvent` agrega/saca el handler de ese registro en un useEffect. El
     `.on('broadcast', { event }, ...)` del canal se registra una sola vez por evento y
     hace fan-out a los handlers registrados.

4. Migrar los 4 consumidores (la lógica de cada handler NO cambia, solo de dónde sale el
   evento):
   - src/app/superadmin/page.tsx            -> 'iglesia:actualizada'
   - src/app/superadmin/iglesias/page.tsx   -> 'iglesia:actualizada'
   - src/components/agenda/evento-dialog.tsx -> 'predicador:respondio'
   - src/components/integrantes/qr-dialog.tsx -> 'integrante:registrado'

5. Actualizar los comentarios que hoy hablan de "socket" / "Socket.IO" / "gateway propio"
   en use-socket.ts (al reescribirlo), api.ts (el bloque de onSessionRefreshed) y donde
   aparezcan. Si hay un frontend/prompt.md o FEATURES.md, dejá la entrada correspondiente.

6. Durante la transición el backend emite por los DOS transportes, así que si algo queda
   a medias no se rompe nada. Pero el objetivo es dejar el frontend 100% en Supabase
   Realtime en este PR.

QUÉ NO HACER
- No usar supabase-js para nada que no sea Realtime.
- No exponer ni pedir el service_role key en el frontend (jamás).
- No inventar campos nuevos en los payloads ni en el request a /realtime/token.
- No tocar el flujo de cookies/CSRF/refresh de apiFetch.
```

---

**Nota para el equipo (no es parte del prompt):**

- El `topic` y los claims (`iglesia_id`, `is_superadmin`) los pone el backend en el JWT
  corto; el frontend no computa nada de eso. El aislamiento multi-tenant lo garantiza
  una policy RLS sobre `realtime.messages` en Supabase (no "el cliente filtra bien").
- El token corto queda en memoria del JS (a diferencia del `access_token`, que está en
  cookie httpOnly). Es un trade-off aceptado y acotado: no sirve para leer datos de
  negocio por PostgREST ni para emitir, y dura ≤30 min. Detalle en
  `docs/realtime-migration.md`.
- Antes de probar en staging: el backend tiene que aplicar la migración de RLS a
  `Backend-staging` y setear el secret de firma en Render. Coordinar.
- La anon key del proyecto `Backend` (no secreta): pedirla al equipo o sacarla del
  dashboard. También sirve la publishable key `sb_publishable_...` si prefieren esa.
