# Prompt — Frontend: estado de convocatoria (in-app + página pública) + UX de bloqueo de login

Copiar/pegar en una sesión de Claude Code sobre el repo del **frontend** (Next.js). El
backend ya está implementado y desplegado en `staging` (rama `staging`, Render
`evangelicapp-backend.onrender.com`, Supabase `Backend-staging`; migraciones aplicadas).

> **Antes que nada:** si todavía no están hechos, aplicá primero los fixes del prompt
> anterior (retry ante 403 de CSRF en `api.ts`, `clearSession()` en la página de reset,
> `NEXT_IMAGES_UNOPTIMIZED=true` en Cloudflare). Sin eso, nada mutante funciona.

Tres bloques.

---

## Contrato del backend (real, no lo inventes)

### 1) Estado de convocatoria IN-APP (equipo de la iglesia)

```
GET /agenda/eventos/:id/convocatoria          (autenticado, módulo AGENDA)
  → {
      predicadores: [
        { id, nombre: string|null, email: string, estado: "PENDIENTE"|"CONFIRMADO"|"RECHAZADO", respondidoAt: string|null }
      ],
      asistencias: [
        { integranteId, nombreCompleto, email, estado: "PENDIENTE"|"CONFIRMADO"|"RECHAZADO", respondidoAt: string|null }
      ]
    }
```

En vivo: el canal de Realtime de la iglesia (`tenant:<iglesiaId>`, el que ya usás) emite
**dos** eventos relevantes:
- `predicador:respondio` → `{ eventoId, predicadorId, nombre, email, estado, respondidoAt }`
- `asistencia:respondida` → `{ eventoId, integranteId, nombreCompleto, estado, respondidoAt }`

`GET /agenda/eventos/:id/asistencias` sigue existiendo igual (por si algo lo usa), pero para
la vista unificada usá `/convocatoria`.

### 2) Página PÚBLICA de estado (se llega desde el link del correo)

Los correos de invitación (al predicador y a la congregación) ya traen un link discreto:
`<FRONTEND_URL>/agenda/convocatoria/<token>` — `<token>` es el `tokenConfirmacion` del propio
destinatario (asistencia o predicador). Rutas nuevas del backend, **públicas** (sin sesión):

```
GET /agenda/convocatoria/:token/estado
  → {
      evento: { titulo, descripcion: string|null, fechaInicio, fechaFin, ubicacion: string|null,
                iglesia: { nombre, logoUrl: string|null } },
      predicadores: [{ id, nombre: string|null, estado, respondidoAt }],      // SIN email
      asistencias:  [{ integranteId, nombreCompleto, estado, respondidoAt }]  // SIN email
    }
  - 404 { message: "Enlace no válido" } si el token no matchea ninguna asistencia/predicador.
  - Throttle: 60/min por IP.

GET /agenda/convocatoria/:token/realtime
  → { token: string, topic: string ("convocatoria:<eventoId>"), expiresInSeconds: number }
  - Es un JWT de Supabase Realtime de vida corta (mismo mecanismo que GET /realtime/token
    pero para un canal por-evento, no por-tenant).
  - Puede responder 503 si el backend no tiene el secret de firma → modo "sin realtime":
    la página funciona igual, solo sin actualización automática.
```

El canal `convocatoria:<eventoId>` emite los MISMOS eventos que arriba
(`predicador:respondio` y `asistencia:respondida`), con el payload SIN email.

### 3) Bloqueo de login (rate limit por cuenta)

`POST /auth/login` ahora puede responder, además de lo de siempre:

```
403 { code: "CUENTA_BLOQUEADA", message: string, minutosRestantes: number }
```

- Se dispara a los **3 intentos fallidos seguidos** → bloqueo de **10 minutos**.
- A los **5 intentos fallidos** la cuenta se **desactiva** (vuelve a `401 "Credenciales
  inválidas"` genérico; recuperación = el MANAGER/SuperAdmin la reactiva, o —si todavía no
  llegó a 5— restablecer la contraseña limpia el contador).
- Un login exitoso, un `change-password` o un `reset-password` dejan el contador en 0.

---

```
Implementá lo siguiente en el frontend. Backend listo y desplegado en staging.

=====================================================================
BLOQUE A — ESTADO DE CONVOCATORIA IN-APP (predicadores + integrantes juntos)
=====================================================================

Hoy `src/components/agenda/asistencias-dialog.tsx` (botón "Ver asistencia" del
evento-dialog) muestra SOLO integrantes. Convertirlo en un "Estado de la
convocatoria" que muestre también a los predicadores invitados.

1. Cambiar el fetch: de `GET /agenda/eventos/:id/asistencias` a
   `GET /agenda/eventos/:id/convocatoria` → { predicadores, asistencias }.

2. Renderizar DOS secciones:
   - "Predicadores invitados": lista con nombre (o el email si nombre es null) +
     badge de estado (reusá ESTADO_PREDICADOR_CLASS / ESTADO_PREDICADOR_LABEL que
     ya existen en components/agenda/types.ts, o el mismo patrón de badges de
     evento-dialog). Si `predicadores` está vacío, no mostrar la sección.
   - "Convocatoria a la congregación": lo que ya hace hoy, agrupado por
     Confirmaron / Sin responder / Rechazaron.

3. En vivo (mientras el dialog está abierto), suscribir con `useRealtimeEvent`:
   - "predicador:respondio": si payload.eventoId === eventoId, parchar el
     predicador (match por payload.predicadorId) → estado + respondidoAt.
   - "asistencia:respondida": igual que hoy (match por payload.integranteId).
   Los contadores por grupo se derivan con .filter, se re-renderizan solos.

4. Renombrá el título del dialog y el botón que lo abre a algo tipo "Ver estado
   de la convocatoria" / "Ver quién confirmó". Poné el nombre del archivo/props
   coherente si querés (asistencias-dialog → convocatoria-dialog), pero no es
   obligatorio.

5. evento-dialog.tsx ya muestra los badges de predicadores en modo edición y ya
   escucha "predicador:respondio" — eso queda como está (o se puede simplificar
   si ahora todo vive en el dialog nuevo, a tu criterio).

=====================================================================
BLOQUE B — PÁGINA PÚBLICA /agenda/convocatoria/[token]
=====================================================================

Nueva ruta pública (sin guard de auth, FUERA del app-shell — mismo tratamiento
que /agenda/asistencia/[token] y /recuperar-contrasena). Agregala a la lista de
rutas sin shell en components/layout/app-shell.tsx
(`pathname.startsWith("/agenda/convocatoria")`).

6. src/app/agenda/convocatoria/[token]/page.tsx — NUEVA.
   - Toma `token` del route param.
   - Al montar: `GET /agenda/convocatoria/:token/estado` vía apiFetch (sin sesión,
     apiFetch funciona igual). 404 → "Este enlace no es válido o el evento ya no
     está disponible."
   - Renderiza: logo + nombre de la iglesia, título/fecha/hora/lugar del evento,
     y las dos secciones (predicadores / congregación) agrupadas por estado, con
     contadores. Sin emails (el backend no los manda). Estética consistente con
     /agenda/asistencia/[token] (Card centrada, max-w, etc.). Que sea legible en
     celular — la mayoría abre esto desde el mail en el teléfono.

7. En vivo (Supabase Realtime):
   - Pedí el token: `GET /agenda/convocatoria/:token/realtime`
     → { token, topic, expiresInSeconds }.  503 → modo "sin realtime" (mostrar un
     texto chico "actualizá la página para ver los últimos cambios", sin errores
     en consola en loop).
   - **Usá un cliente de Supabase SEPARADO del de use-realtime.ts** (que es
     para sesiones). Un `createClient(NEXT_PUBLIC_SUPABASE_URL,
     NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession:false,
     autoRefreshToken:false }})` propio de esta página, o un hook chico
     `use-convocatoria-realtime.ts`. Motivo: los dos llaman `realtime.setAuth()`
     y se pisarían si comparten instancia.
   - `client.realtime.setAuth(token)` → `client.channel(topic, { config: {
     private: true }})` → `.on('broadcast', { event: 'predicador:respondio' },
     ...)` y `.on('broadcast', { event: 'asistencia:respondida' }, ...)` →
     `.subscribe()`.
   - Handlers: parchar la lista correspondiente por id (predicadorId /
     integranteId). El payload viene en `msg.payload`.
   - Renovar: `setTimeout` a `(expiresInSeconds - 60)*1000` → re-pedir el token y
     `setAuth` de nuevo. Limpiar (unsubscribe + clearTimeout) al desmontar.

8. Los correos ya linkean acá — no hay que tocar nada de emails.

=====================================================================
BLOQUE C — UX DE BLOQUEO DE LOGIN
=====================================================================

9. src/app/login/page.tsx — en el `catch` del onSubmit, antes del
   `setServerError` genérico, manejar el nuevo código (igual que ya se maneja
   IGLESIA_SUSPENDIDA):

   if (error instanceof ApiError && (error.body as { code?: string })?.code === "CUENTA_BLOQUEADA") {
     const min = (error.body as { minutosRestantes?: number }).minutosRestantes ?? 10;
     setServerError(
       `Demasiados intentos fallidos. Probá de nuevo en ${min} ${min === 1 ? "minuto" : "minutos"}, ` +
       `o restablecé tu contraseña.`
     );
     return;
   }

   Y que el mensaje de error incluya (o tenga cerca) el link a
   /recuperar-contrasena — que ya existe como "¿Olvidaste tu contraseña?" abajo
   del form, así que con que el texto lo mencione alcanza. No hace falta lógica
   de cuenta regresiva; con el número que manda el backend basta.

10. El caso "cuenta desactivada tras 5 intentos" vuelve como 401 genérico
    ("Credenciales inválidas") — no hay UX especial, el usuario tiene que hablar
    con su administrador o (si no llegó a 5) usar recuperación de contraseña.

=====================================================================
QUÉ NO HACER
=====================================================================
- No exponer emails en la página pública ni en sus payloads de realtime.
- No reusar el cliente Supabase de use-realtime.ts para la página pública.
- No agregar campos a ningún body (ValidationPipe con forbidNonWhitelisted).
- No meter /agenda/convocatoria bajo el layout que exige sesión.
```

---

**Notas para el equipo (no son parte del prompt):**

- **Privacidad de la página pública:** cualquiera con un link de invitación de ese evento
  (toda la congregación convocada + los predicadores) ve la lista de nombres y quién
  confirmó/rechazó. Es lo que se pidió explícitamente ("que la gente pueda ver quién aceptó
  o rechazó"). No se exponen emails ni datos de contacto. Si en algún momento se quiere algo
  más cerrado (solo conteos, o solo confirmados), es un cambio de `ConvocatoriaService` en
  el backend.
- **Bloqueo de login = DoS potencial:** un atacante que conoce un email puede mantenerlo
  bloqueado con intentos fallidos. Es la contrapartida conocida del account lockout; el
  bloqueo de 10 min se auto-cura y el usuario puede saltearlo restableciendo la contraseña.
  La desactivación a los 5 sí necesita un admin. Documentado en `docs/`/`README.md` del
  backend.
- **Migraciones aplicadas a `Backend-staging`** (`20260908203618_add_login_lockout`,
  `20260908204221_realtime_convocatoria_topic`). `Backend` (prod) todavía no — hace falta si
  se corre el backend local.
- Sigue pendiente (bloque anterior) el hardening opcional de `passwordChangedAt` en
  `JwtAuthGuard` — a confirmar con el fundador.
