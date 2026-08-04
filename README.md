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
| Auth | JWT (access + refresh con rotación), Passport (`passport-local`, `passport-jwt`) |
| Validación | `class-validator` / `class-transformer` |
| Email | Nodemailer (SMTP) |
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

- Login por **username** (no email — el email es solo dato de contacto/recuperación).
- Access token (15 min, configurable) + refresh token (7 días, configurable), ambos JWT firmados con secretos distintos.
- **Los tokens viajan en cookies `httpOnly`, nunca en el body de la respuesta ni en `localStorage`** — así un XSS en el frontend no puede robarlos vía JavaScript. Detalle completo (nombres de cookie, atributos, CSRF, CORS) en [`docs/auth-cookies.md`](./docs/auth-cookies.md).
- Los refresh tokens se guardan hasheados (SHA-256) en la tabla `refresh_tokens`, con **rotación atómica**: al usarse uno queda `revoked` vía un `updateMany` condicional (evita doble-emisión si dos requests llegan casi al mismo tiempo). Reusar un refresh token ya rotado se trata como posible robo: revoca **todas** las sesiones activas del usuario y fuerza re-login.
- `JwtStrategy` revalida `usuario.activo` contra la base de datos en **cada** request — desactivar a un usuario corta su acceso de inmediato, no cuando expire el token. Acepta el access token desde la cookie o (transición) desde `Authorization: Bearer`.
- CSRF: patrón double-submit cookie vía `CsrfMiddleware` — toda request mutante (POST/PUT/PATCH/DELETE) que traiga una cookie de sesión debe reflejar su valor en el header `X-CSRF-Token`.
- `mustChangePassword` y `onboardingCompletado` en `Usuario` gatillan pantallas obligatorias en el frontend antes de dejar usar el resto de la app (ver `LoginResponse` en `auth.service.ts`).

### Roles y permisos

| Rol | Alcance | Notas |
|---|---|---|
| `SUPER_ADMIN` | Global (sin `iglesiaId`) | Da de alta iglesias + su manager, asignando plan y fecha de facturación. Dashboard cross-tenant. |
| `MANAGER` | Su iglesia | Dueño del tenant (reemplaza al antiguo `PASTOR`). Único rol que gestiona usuarios, accesos delegados, notas, onboarding y facturación de su iglesia. |
| `USUARIO` | Su iglesia | Reemplaza a los antiguos `TESORERO`/`SECRETARIA`. Su acceso a cada módulo delegable (Agenda, Finanzas, Ceremonias, Integrantes) lo otorga el MANAGER caso a caso vía `AccesoModulo` (módulo `accesos`), no viene fijo por el rol. |
| `MIEMBRO` | Su iglesia | Definido en el schema; sin endpoints propios todavía (no confundir con `Integrante`, el censo de congregantes vía QR del módulo `integrantes`). |

Autorización vía `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` aplicados por controller. Los módulos delegables suman además `ModuloAccessGuard` + `@Modulo(...)`: MANAGER siempre tiene acceso completo (su acceso es por rol, no por lista), USUARIO solo si el MANAGER se lo otorgó. `Notas` es la excepción — no es un módulo delegable, es exclusivo de MANAGER salvo `GET mis-tareas` y `PATCH :id/marcar-hecha`, abiertos también a USUARIO sin necesitar un módulo otorgado.

Rutas públicas (sin guard — el propio token de un solo uso en la URL es la autenticación, no hace falta cuenta en la plataforma): `agenda/predicadores/:token` (confirmación de predicadores por email), `agenda/asistencias/:token` (RSVP de integrantes a un evento) e `integrantes/registro/:qrToken` (alta de un integrante vía el QR propio de la iglesia).

### Planes comerciales y facturación

Cada iglesia contrata uno de 3 planes (`PlanIglesia`: `BASICO`, `MEDIO`, `PRO`), asignado obligatoriamente por el SuperAdmin al crear la iglesia (`POST /iglesias`) junto con la primera fecha de facturación (`proximaFacturacion`) — no hay un plan por defecto. Los topes de cada plan (máximo de usuarios activos y de subdepartamentos de finanzas) viven en `common/constants/plan.ts` (`PLAN_LIMITS`) y se validan al momento de crear (`UsuariosService#create`, `DepartamentosService#create`), nunca de forma retroactiva: bajar de plan no borra ni desactiva nada, solo bloquea crear más hasta volver a estar bajo el tope nuevo.

No hay pasarela de pago todavía: el SuperAdmin confirma los pagos a mano (`POST /iglesias/:id/marcar-pagada`, que avanza la fecha de facturación un mes exacto desde la fecha vencida) y puede ocultar una iglesia con 3+ días de mora (`PATCH /iglesias/:id/ocultar`, reutiliza `EstadoIglesia.SUSPENDIDA`). Una iglesia oculta no puede loguearse ni mantener una sesión activa — `AuthService#validateUser` y `JwtStrategy#validate` revalidan `estado` en cada login/request (mismo patrón que ya existía para `usuario.activo`) y responden 403 con `code: "IGLESIA_SUSPENDIDA"`. El semáforo de facturación (verde/amarillo/rojo según los días que faltan) se calcula siempre en el backend (`common/utils/calcular-facturacion.ts`), nunca en el frontend — ver `GET /iglesias/:id` (SuperAdmin) y `GET /mi-iglesia/facturacion` (MANAGER, informativo).

### Auditoría financiera

`MovimientoAuditLog` guarda un **snapshot JSON inmutable** de cada movimiento en creación/edición/eliminación. Es intencional que no tenga FK al movimiento: si el movimiento se elimina, este es el único registro que sobrevive. Eliminar un movimiento exige reconfirmar la contraseña del usuario (`ConfirmPasswordDto`).

## Módulos

| Módulo | Rutas base | Descripción |
|---|---|---|
| `auth` | `/auth/*` | Login, refresh, logout, `me`, cambio de contraseña. Puede responder 403 `IGLESIA_SUSPENDIDA` si la iglesia está oculta por mora |
| `onboarding` | `/onboarding/*` | Completar datos del manager tras el primer login |
| `usuarios` | `/usuarios/*` | MANAGER gestiona su equipo (rol USUARIO), sujeto al tope de usuarios del plan contratado |
| `accesos` | `/accesos/*` | MANAGER otorga/revoca a cada USUARIO el acceso a los módulos delegables (Agenda, Finanzas, Ceremonias, Integrantes) |
| `super-admin` | `/superadmin/*` | Dashboard global (todas las iglesias, plan, estado, métricas por región) |
| `iglesias` | `/iglesias/*` | Alta de tenant + manager (transaccional, exige plan y fecha de facturación); detalle, cambio de plan, corrección de facturación, marcar pagada y ocultar/mostrar, todo exclusivo de SuperAdmin |
| `mi-iglesia` | `/mi-iglesia/*` | Datos propios de la iglesia (editar, logo) y módulo de facturación informativo (`/mi-iglesia/facturacion`), exclusivo del MANAGER |
| `agenda` | `/agenda/eventos/*`, `/agenda/predicadores/*`, `/agenda/asistencias/*` | Calendario de la iglesia; invitación/confirmación de predicadores por email; RSVP masivo a integrantes |
| `finanzas` | `/finanzas/movimientos/*`, `/finanzas/categorias/*`, `/finanzas/departamentos/*` | Ingresos/egresos, categorías y subdepartamentos propios por iglesia (subdepartamentos solo disponibles en plan Pro), dashboard, export a Excel, audit log |
| `ceremonias` | `/ceremonias/matrimonios/*`, `/ceremonias/bautizos/*`, `/ceremonias/defunciones/*`, `/ceremonias/presentaciones/*` | Libro de ceremonias (folio correlativo por iglesia) + descarga del certificado en PDF |
| `integrantes` | `/integrantes/*`, `/integrantes/registro/:qrToken` | Censo de congregantes vía QR propio de la iglesia; alta pública por QR, gestión desde el equipo |
| `notas` | `/notas/*` | Tareas/recordatorios asignables (MANAGER crea/asigna, equipo marca como hechas) |
| `mail` | — | Servicio interno (Nodemailer o Resend), no expone rutas |
| `prisma` | — | Módulo global que expone `PrismaService` |

## Requisitos

- Node.js 20 LTS
- PostgreSQL 14+ (local o contenedor)
- npm

### Base de datos

El proveedor de base de datos es **Supabase** (proyecto `evangelicapp`, Postgres gestionado) — `DATABASE_URL` en `.env` apunta ahí. Para desarrollo local aislado (sin tocar la base compartida) sigue disponible `docker-compose.yml` en `backend/`: `docker compose up -d postgres` levanta un Postgres 16 local con las mismas credenciales que trae `.env.example` (`user`/`password`/`evangelicapp` en el puerto 5432).

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
| `DATABASE_URL` | Connection string de PostgreSQL para Prisma |
| `PORT` | Puerto HTTP (default 3001) |
| `CORS_ORIGIN` | Uno o varios orígenes del frontend, separados por coma (ej. `http://localhost:3000,https://app.evangelicapp.cl`) |
| `NODE_ENV` | En `production` las cookies de auth se marcan `Secure` (solo viajan por HTTPS) |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRATION` | Firma y expiración del access token (y de su cookie) |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRATION` | Firma y expiración del refresh token (y de su cookie) |
| `FRONTEND_URL` | Usado para construir el link de confirmación de predicadores en el email |
| `SMTP_HOST` / `SMTP_PORT` / `MAIL_FROM` | Configuración del transporte de Nodemailer |

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

Prisma Migrate en modo desarrollo:

```bash
# tras editar prisma/schema.prisma
npm run prisma:migrate -- --name descripcion_del_cambio
```

Esto genera un archivo SQL versionado en `prisma/migrations/` — **no editar migraciones ya aplicadas en `main`**; si algo quedó mal, generar una migración correctiva nueva. En producción se aplican con `prisma migrate deploy` (sin generar nuevas, solo aplica las existentes).

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
- Rol `MIEMBRO` está definido en el schema pero sin endpoints propios todavía.
- Storage de logos es local (`uploads/`) — migrar a un bucket (S3/GCS/etc.) antes de desplegar a un entorno con múltiples instancias o disco efímero.
- `JwtStrategy` todavía acepta `Authorization: Bearer` como fallback además de la cookie — retirarlo una vez confirmado que el frontend migró por completo (ver [`docs/auth-cookies.md`](./docs/auth-cookies.md)).
- No hay pasarela de pago: los planes/facturación se gestionan con confirmación manual del SuperAdmin (ver "Planes comerciales y facturación" más arriba). El módulo de facturación del lado de la iglesia es solo informativo.
- Hosting de la API: hasta ahora Render (ver bitácora en `FEATURES.md`) — a confirmar con el fundador si sigue siendo así ahora que la base de datos vive en Supabase.
