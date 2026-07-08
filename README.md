# EvangelicApp — Backend

API REST para EvangelicApp, plataforma de gestión para iglesias evangélicas de Chile (agenda, finanzas y notas/tareas). Multi-tenant: cada iglesia es un tenant aislado dentro de la misma base de datos.

Este repositorio contiene **solo el backend**. El frontend vive en un repositorio separado a propósito (no es un monorepo).

> Para el contexto de negocio (qué problema resuelve, quién lo usa, cómo se monetiza, roadmap) ver [`CLAUDE.md`](./CLAUDE.md). Este documento es la referencia técnica.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | [NestJS](https://nestjs.com/) 10 (Express) |
| Lenguaje | TypeScript 5 |
| Base de datos | MySQL |
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
- Los refresh tokens se guardan hasheados (SHA-256) en la tabla `refresh_tokens`, con rotación: al usarse uno queda `revoked`. Permite logout real y revocar sesiones (ej. al cambiar contraseña).
- `JwtStrategy` revalida `usuario.activo` contra la base de datos en **cada** request — desactivar a un usuario corta su acceso de inmediato, no cuando expire el token.
- `mustChangePassword` y `onboardingCompletado` en `Usuario` gatillan pantallas obligatorias en el frontend antes de dejar usar el resto de la app (ver `LoginResponse` en `auth.service.ts`).

### Roles y permisos

| Rol | Alcance | Notas |
|---|---|---|
| `SUPER_ADMIN` | Global (sin `iglesiaId`) | Da de alta iglesias + su pastor. Dashboard cross-tenant. |
| `PASTOR` | Su iglesia | Dueño del tenant. Único rol que gestiona usuarios, notas y onboarding. |
| `TESORERO` | Su iglesia | Finanzas + agenda. |
| `SECRETARIA` | Su iglesia | Agenda + sus propias tareas asignadas. |
| `MIEMBRO` | Su iglesia | Definido en el schema; sin endpoints propios todavía. |

Autorización vía `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` aplicados por controller (a veces sobrescrito a nivel de método, ej. `NotasController` restringe a `PASTOR` por defecto pero abre `GET mis-tareas` y `PATCH :id/marcar-hecha` a `TESORERO`/`SECRETARIA`).

Única ruta pública real (sin guard): `agenda/predicadores/:token` — la confirmación de predicadores por email usa el `tokenConfirmacion` de un solo uso como autenticación, sin requerir cuenta en la plataforma.

### Auditoría financiera

`MovimientoAuditLog` guarda un **snapshot JSON inmutable** de cada movimiento en creación/edición/eliminación. Es intencional que no tenga FK al movimiento: si el movimiento se elimina, este es el único registro que sobrevive. Eliminar un movimiento exige reconfirmar la contraseña del usuario (`ConfirmPasswordDto`).

## Módulos

| Módulo | Rutas base | Descripción |
|---|---|---|
| `auth` | `/auth/*` | Login, refresh, logout, `me`, cambio de contraseña |
| `onboarding` | `/onboarding/*` | Completar datos del pastor tras el primer login |
| `usuarios` | `/usuarios/*` | PASTOR gestiona su equipo (Tesorero/Secretaria) |
| `super-admin` | `/superadmin/*` | Dashboard global (todas las iglesias, métricas por región) |
| `iglesias` | `/iglesias/*` | Alta de tenant + pastor (transaccional), detalle para SuperAdmin |
| `agenda` | `/agenda/eventos/*`, `/agenda/predicadores/*` | Calendario de la iglesia; invitación/confirmación de predicadores por email |
| `finanzas` | `/finanzas/movimientos/*`, `/finanzas/categorias/*` | Ingresos/egresos, categorías propias por iglesia, dashboard, export a Excel, audit log |
| `notas` | `/notas/*` | Tareas/recordatorios asignables (PASTOR crea/asigna, equipo marca como hechas) |
| `mail` | — | Servicio interno (Nodemailer), no expone rutas |
| `prisma` | — | Módulo global que expone `PrismaService` |

## Requisitos

- Node.js 20 LTS
- MySQL 8+ (local o contenedor)
- npm

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
| `DATABASE_URL` | Connection string de MySQL para Prisma |
| `PORT` | Puerto HTTP (default 3001) |
| `CORS_ORIGIN` | Origen permitido para CORS (el frontend) |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRATION` | Firma y expiración del access token |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRATION` | Firma y expiración del refresh token |
| `FRONTEND_URL` | Usado para construir el link de confirmación de predicadores en el email |
| `SMTP_HOST` / `SMTP_PORT` / `MAIL_FROM` | Configuración del transporte de Nodemailer |

**Nunca** commitear un `.env` con secretos reales — está en `.gitignore`. En producción, estas variables deben venir del proveedor de hosting/secret manager, no del repo.

### Datos de demo (`npm run prisma:seed`)

Crea 3 iglesias (Metropolitana, Valparaíso, Biobío) y un SuperAdmin:

- Pastor demo: usuario `jperez` / `Temporal123` (con `mustChangePassword` y onboarding pendientes, para probar ese flujo)
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

- Sin tests de integración/e2e (solo unitarios de utilidades puras por ahora).
- Sin `Dockerfile`/`docker-compose` para levantar MySQL local reproducible.
- Rol `MIEMBRO` está definido en el schema pero sin endpoints propios todavía.
- Storage de logos es local (`uploads/`) — migrar a un bucket (S3/GCS/etc.) antes de desplegar a un entorno con múltiples instancias o disco efímero.
