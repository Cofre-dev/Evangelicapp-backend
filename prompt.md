# Prompt — Frontend: recuperación de contraseña + asistencia en vivo + detalle de convocatoria

Contexto para copiar/pegar en una sesión de Claude Code sobre el repo del **frontend**
(Next.js). El backend ya implementó y desplegó su parte en `staging` (rama `staging`,
Render `evangelicapp-backend.onrender.com`, Supabase `Backend-staging`).

Tres bloques, en orden de tamaño. El **1** es el grande (páginas nuevas). El **2** y **3**
son ajustes chicos sobre componentes que ya existen.

---

## Contrato del backend (real, no lo inventes)

### Recuperación de contraseña — 2 endpoints nuevos, públicos

```
POST /auth/forgot-password
  body: { "email": string }
  - Sin sesión. SIEMPRE responde 200 { "ok": true }, exista o no el correo, y
    aunque el envío del mail falle (anti-enumeración). El frontend no distingue
    casos: siempre muestra el mismo mensaje neutro.
  - Throttle: 5 requests / 15 min por IP → un 429 sí puede pasar si el usuario
    reintenta mucho; mostrar "Esperá unos minutos antes de volver a intentar".
  - Manda un correo con un link a  <FRONTEND_URL>/recuperar-contrasena/<token>
  - El token vive 60 minutos y sirve UNA sola vez. Pedir uno nuevo invalida el anterior.

POST /auth/reset-password
  body: { "token": string, "newPassword": string }
  - Sin sesión. El token es el de la URL del link del correo.
  - newPassword: mínimo 8 caracteres, al menos 1 letra y 1 número
    (idéntico a la validación de change-password-modal.tsx — reusá ese schema).
  - 200 { "ok": true }  → contraseña cambiada; redirigir al login.
  - 400 → token inválido / expirado / ya usado; mensaje del backend en err.message.
    Ofrecer volver a /recuperar-contrasena para pedir otro link.
  - Throttle: 10 / 15 min por IP.
  - Efecto: cambia la contraseña, marca el token usado, cierra las sesiones
    locales del usuario. El usuario queda deslogueado en todos lados.
```

Ambas rutas son **CSRF-exentas** en el backend (no requieren `X-CSRF-Token`), igual que
`integrantes/registro` y los `responder` de agenda.

### Asistencia a eventos — evento de Realtime nuevo

El backend ahora emite por Supabase Realtime (mismo canal privado `tenant:<iglesiaId>` que
ya usás) cuando un integrante responde la convocatoria a un evento:

```
evento: "asistencia:respondida"
payload: {
  eventoId: string,
  integranteId: string,
  nombreCompleto: string,
  estado: "CONFIRMADO" | "RECHAZADO",
  respondidoAt: string   // ISO
}
```

El endpoint `GET /agenda/eventos/:id/asistencias` (ya lo usás en `AsistenciasDialog`) sigue
igual: `{ integranteId, nombreCompleto, email, estado, respondidoAt }[]`.

### Convocatoria a la congregación — sin cambios de contrato

El correo a los integrantes ahora menciona al/los predicador(es) invitado(s) que el equipo
cargó **con nombre**. Es 100% backend. Único matiz de UX: un predicador cargado sin
`nombre` (solo email) NO se menciona en ese correo. Ver bloque 3.

---

```
Implementá lo siguiente en el frontend. El backend ya está listo y desplegado en staging.

=====================================================================
BLOQUE 1 — RECUPERACIÓN DE CONTRASEÑA (páginas nuevas)
=====================================================================

1. src/lib/api.ts — agregar las 2 rutas nuevas a CSRF_EXEMPT_PATHS:
     /^\/auth\/forgot-password$/,
     /^\/auth\/reset-password$/,
   (son públicas, sin sesión; si un usuario logueado abre la landing en el mismo
    navegador, su cookie no debe arrastrar la request al circuito de recuperación
    de csrfToken — mismo motivo que las otras exentas.)

2. src/app/login/page.tsx — agregar un link "¿Olvidaste tu contraseña?" debajo del
   botón "Iniciar sesión" (o junto al campo de contraseña), que navegue a
   /recuperar-contrasena. Estilo discreto, consistente con el <p> de "¿No tienes
   una cuenta?" que ya está abajo.

3. src/app/recuperar-contrasena/page.tsx — NUEVA. Página pública (sin guard de auth,
   fuera del layout autenticado — mismo tratamiento que /login).
   - Un input de email + botón "Enviar enlace".
   - Al enviar: POST /auth/forgot-password { email } vía apiFetch.
   - Respuesta 200 (siempre que no sea 429/red): mostrar SIEMPRE el mismo mensaje
     neutro, ej.: "Si el correo está registrado, te enviamos un enlace para
     restablecer tu contraseña. Revisá tu bandeja de entrada y spam."
     Ocultar el formulario tras el envío.
   - 429: "Hiciste varios intentos seguidos. Esperá unos minutos y volvé a probar."
   - Error de red: "No pudimos procesar la solicitud. Intentá de nuevo." y reintentar.
   - Link para volver a /login.
   - Reusar los componentes de UI del login (Card/Form/Input/Button/Alert) y la
     misma estética (logo arriba, max-w-sm, etc.).

4. src/app/recuperar-contrasena/[token]/page.tsx — NUEVA. Página pública. Es la
   landing del link del correo.
   - Toma el token del route param (useParams).
   - Dos campos: "Nueva contraseña" y "Confirmar contraseña" (ambos con toggle
     mostrar/ocultar, autoComplete="new-password").
   - Validación (reusá el schema de src/components/onboarding/change-password-modal.tsx):
       newPassword: z.string().min(8, "...").regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "...")
       confirmar: debe ser igual a newPassword (z .refine / superRefine)
   - El botón "Cambiar contraseña" queda DESHABILITADO hasta que:
       ambos campos no vacíos + coinciden + cumplen la política.
   - Al enviar: POST /auth/reset-password { token, newPassword } vía apiFetch.
     * 200 → redirigir a /login. Mostrar un mensaje de éxito en el login
       ("Tu contraseña se actualizó. Iniciá sesión con la nueva.") — podés pasarlo
       por query param (?reset=ok) y que login lo lea, o por un store/toast, lo que
       ya uses para flashes.
     * 400 → mostrar err.message del ApiError ("El enlace de recuperación no es
       válido o expiró. Solicitá uno nuevo.") + un link a /recuperar-contrasena.
     * Otro error → mensaje genérico + reintento.
   - NO llames a ningún endpoint autenticado desde esta página. NO toques el
     auth-store (el usuario no está logueado acá).
   - Misma estética que /login.

=====================================================================
BLOQUE 2 — ASISTENCIA A EVENTOS EN VIVO
=====================================================================

5. src/components/agenda/asistencias-dialog.tsx — hoy hace un fetch una sola vez al
   abrir. Agregarle Realtime para que la lista se actualice sola mientras está
   abierto, sin refrescar:

   - Usar el mismo hook que ya usás para "predicador:respondio" en evento-dialog.tsx
     (useRealtimeEvent). Suscribir el evento "asistencia:respondida".
   - En el handler: si payload.eventoId === eventoId (el del dialog), actualizar el
     array `asistencias`:
       setAsistencias(prev => prev.map(a =>
         a.integranteId === payload.integranteId
           ? { ...a, estado: payload.estado, respondidoAt: payload.respondidoAt }
           : a
       ))
     Los contadores por grupo (Confirmaron / Sin responder / Rechazaron) ya se
     derivan de `asistencias` con .filter, así que se re-renderizan solos.
   - Ojo: el hook debe estar suscrito solo mientras el dialog está montado/abierto
     (mismo patrón condicional que en evento-dialog: `if (!open) return` dentro del
     efecto del hook, o desmontar el subcomponente cuando open=false).
   - Si tu useRealtimeEvent no acepta un "enabled"/condición, envolvé el contenido
     del dialog en un subcomponente que solo se monte con open=true (como hoy hace
     evento-dialog con predicadores), y poné el hook ahí.

=====================================================================
BLOQUE 3 — DETALLE DEL PREDICADOR EN LA CONVOCATORIA (ajuste menor)
=====================================================================

6. En el formulario de crear evento (evento-dialog.tsx, sección de agregar
   predicadores para eventos tipo CULTO):
   - El backend, en el correo a la congregación, SOLO menciona a los predicadores
     que tienen `nombre` cargado (un email suelto no se muestra a los integrantes).
   - Cuando el evento tiene "notificar a integrantes" activado Y hay predicadores,
     mostrar un hint junto al campo nombre del predicador:
       "El nombre aparece en el correo a la congregación. Sin nombre, no se
        menciona al predicador."
   - NO hagas el nombre obligatorio (el backend lo acepta vacío). Es solo un hint.
   - Si ya hay un textito de ayuda en esa sección, sumale esta aclaración.

=====================================================================
QUÉ NO HACER
=====================================================================
- No agregar campos al body de /auth/reset-password ni /auth/forgot-password
  (ValidationPipe con forbidNonWhitelisted rechaza cualquier extra).
- No tocar el flujo de cookies/CSRF de apiFetch más allá de sumar las 2 rutas a
  CSRF_EXEMPT_PATHS.
- No usar supabase-js para nada nuevo (Realtime ya está resuelto con tu hook).
- Las páginas de recuperación son públicas: no las metas bajo el layout que exige
  sesión ni les pongas useRequireAuth.
```

---

**Notas para el equipo (no son parte del prompt):**

- **Resend**: el backend ya soporta `MAIL_PROVIDER=resend`. En el Render de staging hay
  que setear `MAIL_PROVIDER=resend`, `RESEND_API_KEY=re_...` y
  `MAIL_FROM="EvangelicApp <no-reply@evangelicapp.cl>"` (dominio `evangelicapp.cl` ya
  verificado en Resend). Sin eso, los correos siguen saliendo por SMTP local (Nodemailer)
  y no llegan a nadie en staging. Es config de infra, no de código.
- **Revocación de sesiones tras reset**: el backend cierra las `SesionActividad` locales
  pero no puede revocar los refresh tokens de Supabase sin un access token del usuario
  (que en un "olvidé mi contraseña" casi nunca hay). Riesgo acotado a la vida de un
  refresh token. Documentado en `docs/` del backend.
- **MCP de Resend**: el `.mcp.json` del backend ya tiene el server `resend` configurado
  (`npx -y resend-mcp`), lee `RESEND_API_KEY` del entorno. Sirve para probar envíos /
  gestionar dominios y plantillas desde una sesión de Claude Code.
