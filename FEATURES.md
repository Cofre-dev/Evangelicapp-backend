
# Bitácora de cambios — EvangelicApp Backend

Registro cronológico de cada modificación hecha con ayuda de Claude en este repositorio. **Es de solo agregar**: nunca se borra ni se reescribe una entrada anterior, aunque quede obsoleta — si algo cambia, se documenta como una entrada nueva al final.

Formato de cada entrada:

```
## [YYYY-MM-DD HH:MM] Título breve
**Cambios:** qué se modificó (archivos/áreas)
**Funcionalidad:** para qué sirve / qué problema resuelve
```


---

## [2026-07-08 13:21] Commit inicial del proyecto

**Cambios:** primer commit del repositorio — backend NestJS + Prisma completo: módulos `auth`, `onboarding`, `usuarios`, `super-admin`, `iglesias`, `agenda` (eventos + predicadores), `finanzas` (movimientos + categorías + auditoría), `notas`.

**Funcionalidad:** línea base del backend de EvangelicApp — plataforma de gestión multi-tenant para iglesias evangélicas de Chile (agenda, finanzas, tareas), con autenticación JWT, control de acceso por rol y aislamiento de datos por iglesia.

## [2026-07-08 14:11] Higiene de repositorio, documentación y CI

**Cambios:**
- `.gitignore` en la raíz del repo; se destrackearon `node_modules`, `dist/`, `.env` y los uploads de usuarios (`uploads/logos/*.png`) que estaban commiteados por error (quedan en disco, solo salen del control de versiones de git).
- `README.md`: documentación técnica completa (stack, arquitectura multi-tenant, roles, módulos/rutas, setup, scripts, migraciones, testing, convenciones, pendientes conocidos).
- `CLAUDE.md`: contexto de negocio/producto (problema que resuelve, modelo de tenant explicado en términos de negocio, roles); la sección de modelo de monetización se dejó pendiente a propósito hasta que el fundador la defina, en vez de inventarla.
- `FEATURES.md` (este archivo): bitácora de cambios.
- ESLint 9 (flat config) + Prettier + Jest + ts-jest agregados como devDependencies reales — el `package.json` original tenía scripts `lint`/`test` que referenciaban herramientas nunca instaladas.
- Corrección de ~8 errores reales de tipado que salieron al activar lint estricto: `any` sin controlar en `current-user.decorator.ts`, `jwt-refresh.strategy.ts` y `auth.service.ts`; promesa sin manejar en `main.ts`; ajuste de `prisma.service.ts#enableShutdownHooks`.
- Primer test unitario (`generate-temporary-password.spec.ts`).
- `.github/workflows/ci.yml`: pipeline de GitHub Actions (install → prisma generate → lint → build → test) en cada push/PR a `main`.

**Funcionalidad:** asegurar que el repositorio no siga acumulando archivos que no deberían versionarse, que cualquier sesión (humana o de Claude) tenga contexto completo del proyecto sin releer todo el código desde cero, y que exista una red de seguridad automática (CI) antes de fusionar cambios a `main`.

## [2026-07-08 17:02] Plan: módulo de Colaboradores + QR + convocatorias WhatsApp/email

**Cambios:** sin código todavía — planificación documentada en `docs/colaboradores-qr.md`: modelo de datos (`Colaborador`, `Iglesia.colaboradoresQrToken`), endpoints públicos de registro/baja por QR, endpoints admin, endpoint de convocatoria (`POST /agenda/eventos/:id/convocar`), integración de email (extiende `MailService` existente) y de WhatsApp (API oficial de Meta Cloud API, no librerías no oficiales — decisión explícita del fundador por riesgo de baneo), anti-abuso (rate limit + honeypot) y consentimiento/baja de datos personales. Brief correspondiente para el frontend dejado en `prompt.md`.

**Funcionalidad:** permitir que cada iglesia junte datos de contacto de sus colaboradores/asistentes vía un QR propio, y que el equipo pastoral pueda convocarlos (WhatsApp + email) a un culto con un botón explícito — no automático, para no generar spam en eventos internos.

## [2026-07-09 00:00] Fix: build roto en Render por tipos duplicados de @types/express

**Cambios:** `backend/src/modules/iglesias/logo-upload.config.ts` — se quitó el import explícito de `Request` de `express` y las anotaciones de tipo manuales en los callbacks `filename`/`fileFilter` de la config de Multer, dejando que TypeScript infiera esos tipos por contexto desde `diskStorage`/`FileFilterCallback`.

**Funcionalidad:** el deploy en Render fallaba (`tsc` error TS2322) porque el `node_modules` que resulta del `yarn install` en Render trae una copia anidada distinta de `@types/express` (bajo `@types/passport`), que no calza estructuralmente con el `Request` importado a mano en este archivo. Localmente no se reproducía porque el hoisting de `node_modules` era distinto. Anotar los parámetros a mano no era necesario — dejar que TS infiera el tipo desde la firma de Multer evita depender de qué copia de `@types/express` gane la resolución de módulos, sin cambiar el comportamiento del upload de logos.

## [2026-07-09 23:00] Migración de base de datos: MySQL → PostgreSQL (deploy de prueba en Render)

**Cambios:**
- `backend/prisma/schema.prisma`: `datasource db.provider` cambiado de `"mysql"` a `"postgresql"`. El resto del schema no necesitó cambios (no había tipos ni SQL crudo específicos de MySQL).
- Se eliminaron las 3 migraciones antiguas en `backend/prisma/migrations/` (SQL específico de MySQL, incompatible con Postgres; no había datos reales en la DB de desarrollo que preservar) y se generó una migración inicial nueva (`20260709000000_init`) con sintaxis Postgres (enums nativos, etc.), aplicada con éxito contra la base Postgres creada en Render.
- `backend/.env`, `backend/.env.example`, `.github/workflows/ci.yml`: connection strings de ejemplo actualizados a formato `postgresql://`.
- `README.md`: referencias a MySQL actualizadas a PostgreSQL (stack, requisitos, variables de entorno, pendientes conocidos).
- Se corrió `prisma db seed` contra la DB de Render: quedó con un usuario SUPER_ADMIN (`admin` / `SuperAdmin123`) y 3 iglesias demo con sus pastores (credenciales en `prisma/seed.ts`) para que el equipo pueda probar la app de inmediato.

**Funcionalidad:** el fundador pidió deployar en Render solo para pruebas con usuarios reales (no es la versión final). Render no ofrece MySQL gestionado nativo, solo Postgres, así que en vez de depender de un proveedor externo de MySQL se migró el proyecto completo a Postgres usando la base gestionada del propio Render. Nota para más adelante: las credenciales del seed son de prueba pública y deben rotarse (o el seed no debe correrse) antes de cualquier uso con datos reales de una iglesia.
