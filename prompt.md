# Brief para frontend: login por email (Fase 7 de docs/supabase.md — breaking change)

## Resumen

Empecé la Fase 7 del plan de Supabase (reemplazar el login/Auth propio por Supabase Auth). Es
la fase más grande y riesgosa del plan completo, así que la estoy avanzando en pasos chicos en
vez de cortar todo de una vez — **este primer paso es 100% backend + 1 cambio puntual y
obligatorio en el formulario de login del frontend.** El resto de la migración a Supabase Auth
(cookies, tokens, `supabase-js` en el cliente) todavía no aplica — sigue siendo exactamente el
mismo flujo de siempre (`POST /auth/login`, cookies httpOnly, `POST /auth/refresh`, etc.),
excepto por el campo que se manda.

Como siempre, solo tengo acceso a `frontend/src/app/agenda/asistencia` de su repo, así que no
pude hacer este cambio yo mismo — es chico pero **rompe el login si no se actualiza.**

---

## El cambio: `POST /auth/login` ahora pide `email`, no `username`

**Antes:**
```json
{ "username": "jperez", "password": "..." }
```

**Ahora:**
```json
{ "email": "pastor@demo.cl", "password": "..." }
```

- El campo se llama `email` y se valida como email (`@IsEmail()`) — no manden el username ahí.
- **Si el formulario sigue mandando `username`, el login falla con `401 Unauthorized`** (mismo
  mensaje genérico que "credenciales inválidas" — no hay forma de distinguirlo en el response,
  así que si después de este cambio empiezan a ver logins fallando en masa, esto es lo primero
  a revisar).
- Todo lo demás del formulario de login no cambia: `password` sigue igual, la respuesta sigue
  trayendo `csrfToken`/`usuario`/`requiresPasswordChange`/`requiresOnboarding` con el mismo
  shape de siempre, las cookies (`access_token`, `refresh_token`, `csrf_token`) se siguen
  seteando igual.

**Qué hay que cambiar en la pantalla de login:**
1. El input que hoy dice "Usuario" (o similar) pasa a pedir el email de la persona. Copy
   sugerido: *"Correo electrónico"*.
2. El body del `fetch`/`POST` a `/auth/login` cambia la key de `username` a `email`.
3. Si tienen algo de autocompletado/validación de formulario del lado del cliente, usen
   validación de email (`type="email"` alcanza para la mayoría de los casos).

**Por qué el cambio:** es el primer paso hacia Supabase Auth (Fase 7), que autentica
nativamente por email, no por username. `username` sigue existiendo como campo en el perfil
del usuario (lo van a seguir viendo en `GET /auth/me`, en la gestión de equipo, etc.) — dejó de
ser la credencial de login, nada más.

---

## Lo que NO cambia (por ahora)

- **Nada de `supabase-js` en el frontend todavía.** El login sigue siendo contra `POST
  /auth/login` de nuestra propia API, con cookies httpOnly que arma nuestro backend — no hay
  ningún SDK ni token de Supabase que el frontend tenga que manejar en esta etapa.
- **Sesión, refresh, logout, CSRF**: sin cambios. `POST /auth/refresh`, `POST /auth/logout`,
  el header `X-CSRF-Token`, todo igual que hoy.
- **`GET /auth/me`**: mismo shape de siempre (el `usuario` ahora incluye un campo interno
  `supabaseUserId` que pueden ignorar completamente — es de uso interno del backend, no tiene
  ningún uso ni significado del lado del cliente).
- **Recuperación de contraseña, cambio de contraseña, invitación de equipo**: sin cambios, esos
  flujos ya eran por email o no dependen del campo de login.

---

## Qué viene después (todavía no implementado, no hay nada que hacer ahora)

**Actualizado 2026-08-14 — esto reemplaza lo que decía antes en esta sección**, porque ya
tomé una decisión que cambia el panorama para mejor: **no va a haber un "cambio mucho más
grande" más adelante.** Originalmente pensaba que reemplazar el login/Auth propio por Supabase
Auth iba a terminar en que ustedes tuvieran que instalar `supabase-js` en el frontend y cambiar
cómo manejan la sesión — es lo que Supabase recomienda por defecto (su paquete `@supabase/ssr`).
Evalué ese patrón y decidí NO adoptarlo: sus cookies recomendadas no son `httpOnly` a propósito
(legibles por JS), algo que no queremos dado que manejamos datos financieros y personales de
iglesias, y además asume que el frontend le habla directo al servidor de Auth de Supabase en
vez de a nuestra API.

**Lo que sí va a pasar:** nuestro propio backend va a seguir siendo el único que le habla a
Supabase Auth por dentro. Ustedes van a seguir hablándole exactamente a la misma API de
siempre — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, las mismas 3 cookies
httpOnly, el mismo header `X-CSRF-Token` — sin instalar ningún SDK de Supabase ni cambiar una
sola línea de cómo manejan la sesión hoy. **El único cambio para el frontend en toda esta fase,
pasado y futuro, sigue siendo el de arriba: el campo `email` en vez de `username` en el login.**
El resto (verificación de tokens, guard de permisos, garantías de rotación de sesión, esquema
de cookies) es trabajo 100% interno del backend, ya en curso, sin ningún paso pendiente que
dependa de que ustedes hagan algo.
  