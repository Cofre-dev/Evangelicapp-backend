# EvangelicApp — Backend

API REST para EvangelicApp, plataforma de gestión para iglesias evangélicas de Chile (agenda, finanzas y notas/tareas). Multi-tenant: cada iglesia es un tenant aislado dentro de la misma base de datos.

Este repositorio contiene **solo el backend**. El frontend vive en un repositorio separado a propósito (no es un monorepo).

> Para el contexto de negocio (qué problema resuelve, quién lo usa, cómo se monetiza, roadmap) ver [`CLAUDE.md`](./CLAUDE.md). Para el historial de cambios ver [`FEATURES.md`](./FEATURES.md). Este documento es la referencia técnica.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | [NestJS](https://nestjs.com/) 10 (Express) |
| Lenguaje | TypeScript 5 |
| Base de datos | PostgreSQL (gestionado por Supabase) |
| ORM | [Prisma](https://www.prisma.io/) 5 |
| Auth | Supabase Auth (GoTrue) — sesión real emitida por Supabase, verificada vía JWKS (`jose`); `passport-local` solo para el binding de credenciales en `POST /auth/login` |
| Validación | `class-validator` / `class-transformer` |
| Email | Nodemailer (SMTP) o Resend, según `MAIL_PROVIDER` |
| WhatsApp | Meta Cloud API (WhatsApp Business), vía `fetch` nativo — convocatoria a integrantes |
| Excel | ExcelJS (export de movimientos financieros) |
| Lint/Format | ESLint 9 (flat config) + Prettier |
| Tests | Jest + ts-jest |
| CI | GitHub Actions |

Todo el código vive en `backend/`.

## Arquitectura

### Multi-tenancy

`Iglesia` es el tenant raíz. Toda tabla transaccional (`Evento`, `MovimientoFinanciero`, `Nota`, etc.) tiene una columna `iglesiaId` obligatoria con `onDelete: Cascade`. `SUPER_ADMIN` es el único rol que **no** pertenece a ninguna iglesia (`iglesiaId: null`) — opera fuera de cualquier tenant, con visibilidad cruzada solo a través del módulo `super-admin`.

**Regla de oro del código**: el `iglesiaId` con el que se filtra/crea siempre sale del JWT (`@CurrentUser()` en el controller), nunca del body/params del request. Cada controller de recurso de iglesia tiene un helper privado `requireIglesiaId(user)` que lanza `ForbiddenException` si el usuario no tiene iglesia asociada (le pasaría solo a un SUPER_ADMIN llamando por error un endpoint de tenant). Los servicios reciben `iglesiaId` como primer argumento explícito y lo usan en cada `where` — ver `src/modules/finanzas/movimientos.service.ts` como referencia del patrón.

Al agregar un modelo/endpoint nuevo, seguir el mismo patrón: `iglesiaId` desde el JWT → helper en el controller → primer parámetro del método del service → presente en todo `where`/`create`.

### Auth

**Desde el corte de la Fase 7 de `docs/supabase.md` (2026-08-16), la sesión real la emite Supabase
Auth (GoTrue), no un JWT propio.** `POST /auth/login`/`POST /auth/refresh` hablan server-to-server
con la API REST de GoTrue (`grant_type=password`/`grant_type=refresh_token`) — el navegador nunca
corre `supabase-js` ni le habla a Supabase directamente, sigue hablando solo con esta API.

- Login por **email** (no username — `username` sigue existiendo en el modelo como dato de
  visualización, pero dejó de ser la credencial de acceso).
- `access_token` es un JWT real de Supabase (ES256, verificable vía JWKS); `refresh_token` es un
  **string opaco** (no un JWT) — solo se puede validar presentándoselo de nuevo a GoTrue, no hay
  nada que verificar localmente.
- **Los tokens viajan en cookies `httpOnly`, nunca en el body de la respuesta ni en `localStorage`** — así un XSS en el frontend no puede robarlos vía JavaScript. Detalle completo (nombres de cookie, atributos, CSRF, CORS) en [`docs/auth-cookies.md`](./docs/auth-cookies.md).
- La rotación y detección de reuso de refresh tokens las hace Supabase del lado de GoTrue, no una
  tabla local (`RefreshToken` sigue en el schema pero ya no se usa — pendiente de eliminar en una
  migración aparte). Diferencia real de comportamiento respecto al sistema anterior: GoTrue tiene
  un período de gracia de reuso (~10s, pensado para reintentos de red), no revoca todo al instante
  ante cualquier reuso como hacía el sistema propio que reemplazó.
- `JwtAuthGuard` (`common/guards/jwt-auth.guard.ts`) verifica el access token vía JWKS
  (`SupabaseJwtVerifierService`) y revalida en la misma query `usuario.activo`,
  `iglesia.estado !== SUSPENDIDA` y el allowlist de `mustChangePassword` — desactivar a un usuario
  corta su acceso de inmediato, no cuando expire el token. Acepta el token desde la cookie o
  (transición) desde `Authorization: Bearer`.
- **Fallback auto-sanador**: si Supabase rechaza una contraseña que el hash local (bcrypt) sí
  reconoce como correcta (contraseña cambiada antes de que existiera esta sincronización, cuenta
  espejada desde otro entorno, etc.), `AuthService` sincroniza hacia Supabase y reintenta antes de
  dar por inválida la contraseña — nunca emite una sesión basada solo en bcrypt, los tokens reales
  siempre salen de Supabase. Mismo mecanismo lo usan `changePassword` y `verifyPassword`
  (confirmación de contraseña para acciones sensibles).
- CSRF: patrón double-submit cookie vía `CsrfMiddleware` — toda request mutante (POST/PUT/PATCH/DELETE) que traiga una cookie de sesión debe reflejar su valor en el header `X-CSRF-Token`. Es 100% propio, no depende de quién emite el token de sesión.
- `mustChangePassword` y `onboardingCompletado` en `Usuario` gatillan pantallas obligatorias en el frontend antes de dejar usar el resto de la app (ver `LoginResponse` en `auth.service.ts`).
- Confirmación de contraseña para acciones sensibles (`ConfirmPasswordDto` — borrar ceremonias/movimientos, corregir fecha de facturación) responde `403 Forbidden` si la contraseña no coincide, nunca `401` — 401 se reserva para "tu sesión no es válida"; usar el mismo código para ambos casos hacía que algunos frontends interpretaran una contraseña de confirmación mal escrita como sesión inválida y cerraran sesión.
- Bloqueo de login por cuenta (además del techo por IP de `ThrottlerGuard`): `Usuario.failedLoginAttempts`/`lockedUntil` — 3 fallos seguidos → bloqueo 10 min (`CuentaBloqueadaException`, 403 `code: CUENTA_BLOQUEADA` con `minutosRestantes`); 5 fallos → `activo = false` (reactivación por MANAGER/SuperAdmin). Un login OK, `changePassword` o `resetPassword` limpian el contador. El bloqueo revela que la cuenta existe (inherente) y es DoS-able (mitigado: se auto-cura y se saltea con recuperación de contraseña; solo la desactivación necesita admin).

### Roles y permisos

| Rol | Alcance | Notas |
|---|---|---|
| `SUPER_ADMIN` | Global (sin `iglesiaId`) | Da de alta iglesias + su manager, asignando plan y fecha de facturación. Dashboard cross-tenant. |
| `MANAGER` | Su iglesia | Dueño del tenant (reemplaza al antiguo `PASTOR`). Único rol que gestiona usuarios, accesos delegados, notas, onboarding y facturación de su iglesia. |
| `USUARIO` | Su iglesia | Reemplaza a los antiguos `TESORERO`/`SECRETARIA`. Su acceso a cada módulo delegable (Agenda, Finanzas, Ceremonias, Integrantes) lo otorga el MANAGER caso a caso vía `AccesoModulo` (módulo `accesos`), no viene fijo por el rol. |

Autorización vía `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` aplicados por controller. Los módulos delegables suman además `ModuloAccessGuard` + `@Modulo(...)`: MANAGER siempre tiene acceso completo (su acceso es por rol, no por lista), USUARIO solo si el MANAGER se lo otorgó. `Notas` es la excepción — no es un módulo delegable, es exclusivo de MANAGER salvo `GET mis-tareas` y `PATCH :id/marcar-hecha`, abiertos también a USUARIO sin necesitar un módulo otorgado.

Rutas públicas (sin guard — el propio token de un solo uso en la URL/body es la autenticación, no hace falta cuenta en la plataforma): `agenda/predicadores/:token` (confirmación de predicadores por email), `agenda/asistencias/:token` (RSVP de integrantes a un evento), `agenda/convocatoria/:token/*` (página de estado en vivo de la convocatoria de un evento — el `:token` es el `tokenConfirmacion` del propio destinatario, solo resuelve el evento, no expone emails), `integrantes/registro/:qrToken` (alta de un integrante vía el QR propio de la iglesia), y `auth/forgot-password` / `auth/reset-password` (recuperación de contraseña — `forgot-password` responde siempre 200 para no filtrar qué correos están registrados).

### Planes comerciales y facturación

Cada iglesia contrata uno de 3 planes (`PlanIglesia`: `BASICO`, `MEDIO`, `PRO`), asignado obligatoriamente por el SuperAdmin al crear la iglesia (`POST /iglesias`) junto con la primera fecha de facturación (`proximaFacturacion`) — no hay un plan por defecto. Los topes de cada plan (máximo de usuarios activos y de subdepartamentos de finanzas) viven en `common/constants/plan.ts` (`PLAN_LIMITS`) y se validan al momento de crear (`UsuariosService#create`, `DepartamentosService#create`), nunca de forma retroactiva: bajar de plan no borra ni desactiva nada, solo bloquea crear más hasta volver a estar bajo el tope nuevo.

No hay pasarela de pago todavía: el SuperAdmin confirma los pagos a mano (`POST /iglesias/:id/marcar-pagada`, que avanza la fecha de facturación un mes exacto desde la fecha vencida) y puede ocultar una iglesia con 3+ días de mora (`PATCH /iglesias/:id/ocultar`, reutiliza `EstadoIglesia.SUSPENDIDA`). Una iglesia oculta no puede loguearse ni mantener una sesión activa — `AuthService#validateUser` y `JwtAuthGuard#canActivate` revalidan `estado` en cada login/request (mismo patrón que ya existía para `usuario.activo`) y responden 403 con `code: "IGLESIA_SUSPENDIDA"`. El semáforo de facturación (verde/amarillo/rojo según los días que faltan) se calcula siempre en el backend (`common/utils/calcular-facturacion.ts`), nunca en el frontend — ver `GET /iglesias/:id` (SuperAdmin) y `GET /mi-iglesia/facturacion` (MANAGER, informativo).

### Auditoría financiera

`MovimientoAuditLog` guarda un **snapshot JSON inmutable** de cada movimiento en creación/edición/eliminación. Es intencional que no tenga FK al movimiento: si el movimiento se elimina, este es el único registro que sobrevive. Eliminar un movimiento exige reconfirmar la contraseña del usuario (`ConfirmPasswordDto`).

## Módulos

| Módulo | Rutas base | Descripción |
|---|---|---|
| `auth` | `/auth/*` | Login, refresh, logout, `me`, cambio de contraseña, recuperación de contraseña (`forgot-password`/`reset-password`, públicas). Puede responder 403 `IGLESIA_SUSPENDIDA` si la iglesia está oculta por mora |
| `onboarding` | `/onboarding/*` | Completar datos del manager tras el primer login |
| `usuarios` | `/usuarios/*` | MANAGER gestiona su equipo (rol USUARIO), sujeto al tope de usuarios del plan contratado |
| `accesos` | `/accesos/*` | MANAGER otorga/revoca a cada USUARIO el acceso a los módulos delegables (Agenda, Finanzas, Ceremonias, Integrantes) |
| `super-admin` | `/superadmin/*` | Dashboard global (todas las iglesias, plan, estado, métricas por región) |
| `iglesias` | `/iglesias/*` | Alta de tenant + manager (transaccional, exige plan y fecha de facturación); detalle, cambio de plan, corrección de facturación, marcar pagada y ocultar/mostrar, todo exclusivo de SuperAdmin |
| `mi-iglesia` | `/mi-iglesia/*` | Datos propios de la iglesia (editar, logo) y módulo de facturación informativo (`/mi-iglesia/facturacion`), exclusivo del MANAGER |
| `agenda` | `/agenda/eventos/*`, `/agenda/predicadores/*`, `/agenda/asistencias/*`, `/agenda/convocatoria/*` | Calendario de la iglesia; invitación/confirmación de predicadores por email; RSVP masivo a integrantes; página pública de estado en vivo de la convocatoria (predicadores + integrantes) accesible desde el link del correo |
| `finanzas` | `/finanzas/movimientos/*`, `/finanzas/categorias/*`, `/finanzas/departamentos/*` | Ingresos/egresos, categorías y subdepartamentos propios por iglesia (subdepartamentos solo disponibles en plan Pro), dashboard, export a Excel, audit log |
| `ceremonias` | `/ceremonias/matrimonios/*`, `/ceremonias/bautizos/*`, `/ceremonias/defunciones/*`, `/ceremonias/presentaciones/*` | Libro de ceremonias (folio correlativo por iglesia) + descarga del certificado en PDF |
| `integrantes` | `/integrantes/*`, `/integrantes/registro/:qrToken` | Censo de congregantes vía QR propio de la iglesia; alta pública por QR, gestión desde el equipo |
| `notas` | `/notas/*` | Tareas/recordatorios asignables (MANAGER crea/asigna, equipo marca como hechas) |
| `mail` | — | Servicio interno (Nodemailer o Resend, según `MAIL_PROVIDER`), no expone rutas |
| `whatsapp` | — | Servicio interno (Meta Cloud API) — convocatoria a integrantes vía `eventos.service.ts#notificarIntegrantes`, siempre junto al email, nunca en su reemplazo. Sin `WHATSAPP_ACCESS_TOKEN` configurado, queda en no-op (el email sigue funcionando) |
| `realtime` | WebSocket (no HTTP) | Un solo gateway para 3 pantallas en vivo (dashboard SuperAdmin, evento del pastor, censo de integrantes) — WebSocket propio, no Supabase Realtime nativo (evita depender de RLS, que todavía no está activo) |
| `supabase` | — | Módulo global (`@Global()`): `SupabaseStorageService` (Storage — logos/fotos), `SupabaseAuthService` (login/refresh/signOut reales contra GoTrue), `SupabaseJwtVerifierService` (verificación JWKS del access token) |
| `prisma` | — | Módulo global que expone `PrismaService` |

## Requisitos

- Node.js 20 LTS
- PostgreSQL 14+ (local o contenedor)
- npm

### Base de datos

El proveedor de base de datos es **Supabase** (proyecto `Backend`, Postgres gestionado) —
`DATABASE_URL` en `.env` apunta ahí directamente; es la fuente de verdad real, no un fallback.
**Nota:** esa base ya tiene datos de uso real del equipo fundador (no es solo data descartable de
demo) — confirmar antes de correr el seed o cualquier operación masiva. `docker-compose.yml`
sigue en `backend/` por si hace falta un Postgres local aislado para pruebas puntuales, pero
**ya no es el flujo de trabajo habitual** (se usó temporalmente entre el 2026-08-07 y el
2026-08-16 mientras el proyecto de Supabase estaba pausado — ver `FEATURES.md`).

Auth es un proyecto de Supabase **separado y desechable** (`Backend-auth-test`,
`SUPABASE_AUTH_TEST_*` en `.env`) — nunca el mismo proyecto que Storage/DB. Ver
[`docs/supabase.md`](./docs/supabase.md) (Fase 7) para el porqué de esa separación.

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env   # completar valores locales
npm run prisma:generate
npm run prisma:migrate  # aplica las migraciones en prisma/migrations
npm run prisma:seed     # datos de demo (ver abajo)
npm run start:dev
```

La API queda en `http://localhost:3001` (o el `PORT` que definas). Los logos de iglesias se sirven como estáticos desde `/uploads/*`.

### Variables de entorno

Ver `backend/.env.example`. Resumen:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Connection string de PostgreSQL para Prisma (proyecto real de Supabase) |
| `PORT` | Puerto HTTP (default 3001) |
| `CORS_ORIGIN` | Uno o varios orígenes del frontend, separados por coma (ej. `http://localhost:3000,https://app.evangelicapp.cl`) |
| `NODE_ENV` | En `production` las cookies de auth se marcan `Secure` (solo viajan por HTTPS) |
| `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | Duración de las cookies de sesión (los tokens en sí ya no los firma este backend, los emite Supabase) |
| `FRONTEND_URL` | Usado para construir links de confirmación (predicadores, integrantes) en emails/WhatsApp |
| `SMTP_HOST` / `SMTP_PORT` / `MAIL_FROM` | Transporte SMTP (Nodemailer), usado si `MAIL_PROVIDER="smtp"` (default) |
| `MAIL_PROVIDER` / `RESEND_API_KEY` | `"smtp"` (default) o `"resend"` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Proyecto real de Supabase — Storage (logos, fotos, certificados) |
| `SUPABASE_AUTH_TEST_URL` / `SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY` / `SUPABASE_AUTH_TEST_ANON_KEY` | Proyecto de Supabase **separado y desechable** dedicado a Auth (`Backend-auth-test`) — opcionales, sin ellas el login real queda inoperante en ese entorno pero el resto del backend sigue funcionando |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_API_VERSION` / `WHATSAPP_TEMPLATE_CONVOCATORIA_EVENTO` | Meta Cloud API — opcionales, sin `WHATSAPP_ACCESS_TOKEN` la convocatoria por WhatsApp queda en no-op (el email sigue funcionando) |

**Nunca** commitear un `.env` con secretos reales — está en `.gitignore`. En producción, estas variables deben venir del proveedor de hosting/secret manager, no del repo.

### Datos de demo (`npm run prisma:seed`)

Crea 3 iglesias (Metropolitana, Valparaíso, Biobío) y un SuperAdmin — con plan y fecha de facturación distintos entre sí a propósito (`prisma/seed.ts`), para ver el semáforo de facturación en sus 3 colores sin tener que armar los datos a mano:

- Manager demo: usuario `jperez` / `Temporal123` (con `mustChangePassword` y onboarding pendientes, para probar ese flujo)
- SuperAdmin: usuario `admin` / `SuperAdmin123`

### Crear un SuperAdmin manualmente

```bash
npm run create:superadmin -- --username=<usuario> --email=<correo> --nombre=<nombre> --apellido=<apellido> [--password=<contraseña>]
```

Si no se pasa `--password`, se genera una temporal que se imprime una sola vez en consola.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run start:dev` | Servidor en modo watch |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Corre el build compilado |
| `npm run lint` | ESLint con `--fix` (uso local) |
| `npm run lint:ci` | ESLint sin autofix (lo que corre en CI) |
| `npm run format` | Prettier sobre `src/` y `test/` |
| `npm test` | Jest |
| `npm run prisma:generate` | Regenera el cliente de Prisma tras tocar el schema |
| `npm run prisma:migrate` | Crea/aplica una migración en desarrollo |
| `npm run prisma:seed` | Corre `prisma/seed.ts` |
| `npm run create:superadmin` | Alta de un SUPER_ADMIN por CLI |

## Migraciones de base de datos

**Importante — `DATABASE_URL` apunta al proyecto real de Supabase, compartido, no a un Postgres
local propio de cada dev.** `npm run prisma:migrate` (`prisma migrate dev`) está pensado para un
Postgres descartable donde Prisma puede resetear/recrear libremente — correrlo tal cual contra la
base compartida es arriesgado. Convención de este repo (ver `github.md`): escribir la migración,
revisar el SQL generado, y aplicarla con `prisma migrate deploy` (no genera nada nuevo, solo
aplica lo que ya existe en `prisma/migrations/`), igual que se hace en producción:

```bash
# tras editar prisma/schema.prisma — generar el SQL sin aplicarlo todavía
npx prisma migrate dev --create-only --name descripcion_del_cambio
# revisar prisma/migrations/<timestamp>_descripcion_del_cambio/migration.sql a mano
npx prisma migrate deploy
```

**No editar migraciones ya aplicadas en `main`**; si algo quedó mal, generar una migración
correctiva nueva. Antes de aplicar cualquier migración contra la base real, correr
`npx prisma migrate status` primero — si aparece una fila de tracking corrupta o una tabla que no
está en `schema.prisma`, investigar antes de seguir (ver `FEATURES.md`, entrada del 2026-08-16,
para un caso real de esto).

## Testing

```bash
npm test
```

Jest + ts-jest, specs colocados junto al código como `*.spec.ts` (convención de Nest). La cobertura actual es mínima (utilidades puras) — es la base sobre la que hay que ir agregando tests de servicios (con `@nestjs/testing` + mocks de `PrismaService`) a medida que crece la lógica de negocio, priorizando `finanzas` y `auth` por ser los módulos más sensibles.

## CI

`.github/workflows/ci.yml` corre en cada push/PR a `main`: instala dependencias, genera el cliente de Prisma, lintea (`lint:ci`), compila y corre los tests. No requiere una base de datos real (no hay tests de integración todavía) — las variables de entorno del job son valores dummy solo para que `ConfigService` no falle.

## Convenciones de código

- **Nunca** confiar en un `iglesiaId` que venga del cliente; siempre del JWT.
- Servicios reciben `iglesiaId` (y `usuarioId` cuando aplica auditoría) como parámetros explícitos, no lo leen de un contexto implícito.
- DTOs con `class-validator` en cada input; `ValidationPipe` global tiene `whitelist` + `forbidNonWhitelisted`, así que cualquier campo no declarado en el DTO se rechaza.
- Errores de constraint única de Prisma (`P2002`) se traducen a mensajes legibles vía `translateUniqueConstraintError` en vez de dejar pasar el error crudo de Prisma.
- Comentarios solo donde el código no explica el *por qué* (reglas de negocio no obvias, workarounds). Ver `prisma/schema.prisma` como ejemplo del estilo esperado.

## Pendientes conocidos

- Sin tests de integración/e2e (solo unitarios de utilidades puras y del middleware CSRF por ahora).
- `JwtAuthGuard` todavía acepta `Authorization: Bearer` como fallback además de la cookie — retirarlo una vez confirmado que el frontend migró por completo (ver [`docs/auth-cookies.md`](./docs/auth-cookies.md)).
- No hay pasarela de pago: los planes/facturación se gestionan con confirmación manual del SuperAdmin (ver "Planes comerciales y facturación" más arriba). El módulo de facturación del lado de la iglesia es solo informativo.
- El modelo `RefreshToken` sigue en `schema.prisma` pero ya no se usa (Supabase Auth maneja la rotación/reuso de refresh tokens desde el corte de la Fase 7) — pendiente una migración aparte para eliminar la tabla, no urgente.
- Recuperación de contraseña (`POST /auth/reset-password`): cierra las `SesionActividad` locales del usuario pero **no revoca los refresh tokens de Supabase** — hacerlo exige un access token del usuario (que en un "olvidé mi contraseña" casi nunca hay) o una llamada admin por-usuario que `SupabaseAuthService` no expone todavía. Riesgo acotado a la vida de un refresh token (una sesión vieja sobrevive hasta su próximo refresh). Ver `FEATURES.md` 2026-09-08.
- Fase 8 de `docs/supabase.md` (RLS) ya está implementada (policies + rol `app_runtime` sin `BYPASSRLS`, ver `FEATURES.md` 2026-08-20) pero **no está activa en producción todavía**: `DATABASE_URL` en Render sigue apuntando al rol `postgres` (con `BYPASSRLS`), no a `app_runtime`. Falta actualizar esa variable de entorno en Render y correr `prisma migrate resolve --applied 20260820181542_enable_rls_tenant_isolation` desde un entorno con conectividad directa a la base.
- Hosting de la API: hasta ahora Render (ver bitácora en `FEATURES.md`) — a confirmar con el fundador si sigue siendo así.
