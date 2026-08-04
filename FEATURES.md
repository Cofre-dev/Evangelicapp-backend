
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

## [2026-07-10 01:30] Fix: cookies de sesión no persistían en deploy cross-site (Vercel + Render)

**Cambios:** `backend/src/modules/auth/cookies.ts` — el atributo `sameSite` de las cookies de auth (access token, refresh token, csrf token) pasó de estar fijo en `'lax'` a ser condicional: `'none'` cuando `NODE_ENV=production` (igual condición que ya se usaba para `secure`), `'lax'` en desarrollo.

**Funcionalidad:** con el frontend en Vercel y el backend en Render (dominios distintos), el login dejaba las cookies seteadas pero el navegador no las reenviaba en la siguiente request autenticada — `SameSite=Lax` no viaja en fetch/XHR cross-site, así que la app trataba al usuario como no autenticado y lo devolvía al login apenas intentaba usar cualquier funcionalidad. `SameSite=None` es el valor correcto para este escenario cross-site, y solo es válido junto con `Secure` (ya cubierto, porque ambos dependen de la misma condición de producción). En desarrollo local (mismo `site`, solo puertos distintos) `Lax` sigue siendo válido y más restrictivo, así que se mantiene ahí.

## [2026-08-03 00:00] Planes comerciales (Básico/Medio/Pro) + facturación mensual con bloqueo por mora

**Cambios:**
- `prisma/schema.prisma`: nuevo enum `PlanIglesia` (`BASICO`/`MEDIO`/`PRO`) y 3 campos en `Iglesia` — `plan` (obligatorio, sin default), `proximaFacturacion` (obligatorio) y `ultimoPagoAt` (opcional). `EstadoIglesia.SUSPENDIDA` (ya existía en el schema, sin uso real) pasa a tener un significado operativo concreto: iglesia oculta por mora. Migración `20260803120000_add_plan_facturacion_iglesia` (escrita a mano — no había un Postgres local corriendo para generarla con `prisma migrate dev`; backfillea las filas existentes con un `DEFAULT` temporal que se quita en la misma migración).
- `common/constants/plan.ts`: topes por plan (`PLAN_LIMITS`: 3/8/15 usuarios, 0/0/10 subdepartamentos de finanzas) y `PLAN_LABEL`.
- `common/constants/facturacion.ts` + `common/utils/calcular-facturacion.ts`: semáforo de facturación (verde >7 días, amarillo ≤7, rojo ≤2 o vencida) y `sumarUnMes` (avanza la fecha de facturación un mes calendario exacto, clampeado a fin de mes, sin dependencias nuevas).
- `common/exceptions/iglesia-suspendida.exception.ts`: excepción compartida (`code: "IGLESIA_SUSPENDIDA"`) usada tanto en el login como en cada request autenticado.
- `modules/iglesias`: `CreateIglesiaDto` ahora exige `plan` y `proximaFacturacion`. Nuevos endpoints en `IglesiasController`/`IglesiasService`: `PATCH /iglesias/:id/plan`, `PATCH /iglesias/:id/facturacion`, `POST /iglesias/:id/marcar-pagada` (avanza la fecha un mes y reactiva la iglesia), `PATCH /iglesias/:id/ocultar` (oculta la iglesia; exige 3+ días de mora, validado también server-side) y `PATCH /iglesias/:id/mostrar`. `GET /iglesias/:id` ahora devuelve `facturacion` (semáforo calculado) y `limites` (uso actual de usuarios/departamentos vs. el tope del plan).
- `modules/super-admin/super-admin.service.ts`: la lista de iglesias del dashboard ahora incluye `plan`.
- `modules/auth`: `AuthService#validateUser` bloquea el login con `IglesiaSuspendidaException` si la iglesia del usuario está oculta por mora (después de validar la contraseña, no antes — no cambia la discreción ante credenciales incorrectas). `JwtStrategy#validate` revalida lo mismo en cada request autenticado, igual que ya hacía con `usuario.activo`, para cortar sesiones activas de inmediato si la iglesia se oculta a mitad de camino. `SafeUsuario.iglesia` ahora incluye `plan`, visible para cualquier rol de la iglesia (no solo MANAGER).
- `modules/usuarios/usuarios.service.ts`: `create()` cuenta los usuarios activos (`MANAGER`+`USUARIO`) contra `PLAN_LIMITS` y responde 403 (`code: "PLAN_LIMITE_USUARIOS"`) con un mensaje que ya incluye el contacto comercial.
- `modules/finanzas/departamentos.service.ts`: `create()` responde 403 `PLAN_SIN_SUBDEPARTAMENTOS` (Básico/Medio) o `PLAN_LIMITE_DEPARTAMENTOS` (Pro sobre 10) antes de crear el departamento.
- `modules/mi-iglesia`: nuevo endpoint `GET /mi-iglesia/facturacion` (solo MANAGER) — plan contratado, semáforo de facturación y uso actual contra los topes del plan; es el módulo informativo del lado de la iglesia (sin pasarela de pago todavía).
- `prisma/seed.ts`: las 3 iglesias demo ahora tienen plan y fecha de facturación variados (PRO/verde, MEDIO/amarillo, BASICO/rojo-en mora) calculados en relativo a "hoy" para que el semáforo se vea correcto sin importar cuándo se corra el seed.
- `prompt.md`: brief detallado para el equipo de frontend (repo separado) con todos los contratos de API, dónde engancharse en las pantallas existentes (`CreateIglesiaDialog`, dashboard y detalle de SuperAdmin, `auth-store`, `api.ts`) y las pantallas nuevas a construir (página de cuenta suspendida, módulo de Facturación).

**Funcionalidad:** el equipo comercial va a lanzar el producto con 3 planes pagos. Esto le da al SuperAdmin control total sobre qué plan y qué fecha de cobro tiene cada iglesia, aplica los topes de uso de cada plan (usuarios y subdepartamentos de finanzas) a nivel de backend (no solo de UI), y — como todavía no hay pasarela de pago — le da al SuperAdmin una forma manual de marcar pagos y, si una iglesia lleva 3+ días sin pagar, ocultarla (bloqueando el login de todo su equipo con una pantalla explicando la mora) sin perder ninguno de sus datos.

**Pendiente de validar:** no había un Postgres local corriendo (Docker Desktop instalado pero no iniciado) para aplicar la migración y probarla de punta a punta contra una base real antes de este commit — hacerlo como primer paso antes de desplegar (`npm run prisma:migrate` con la base local levantada).

## [2026-08-04 00:00] Base de datos migrada a Supabase (Postgres gestionado)

**Cambios:**
- `backend/.env` (no versionado — no hay cambio en git de este archivo): `DATABASE_URL` ahora apunta al proyecto Supabase `evangelicapp` (`db.lkcgiqmgdefhxhckedga.supabase.co`) en vez de a un Postgres local.
- Se corrió `prisma migrate deploy` contra esa base: aplicó la única migración pendiente (`20260803120000_add_plan_facturacion_iglesia`, ver entrada anterior) — las otras 9 migraciones ya estaban aplicadas ahí de antes, o sea el proyecto Supabase ya tenía el schema de la app y datos reales (1 iglesia, 4 usuarios, 12 movimientos financieros) de una conexión previa que no había quedado documentada en esta bitácora. La iglesia existente quedó con plan `BASICO` y facturación a 30 días vía el backfill que trae la migración — no se perdió ningún dato.
- No se tocó `backend/.env.example` (se mantiene con el placeholder genérico de Postgres local).

**Funcionalidad:** el fundador decidió que Supabase (no Render/Vercel) es la base de datos real del proyecto de acá en adelante. Esto deja el schema de este repo (incluyendo el módulo de planes/facturación de la entrada anterior) reflejado en la base real, no solo en local.

**Pendiente:** confirmar/documentar en `README.md` que Supabase es ahora el proveedor de base de datos oficial (el documento todavía describe el setup con Postgres local vía `docker-compose`/`.env` genérico); y revisar con el fundador si el hosting de la API (hoy en Render según el historial de esta bitácora) también se está moviendo, ya que mencionó dejar de usar Render/Vercel.

## [2026-08-04 00:30] README.md y TODO.md puestos al día con planes/facturación y Supabase

**Cambios:**
- `README.md`: sección "Roles y permisos" corregida (roles `PASTOR`/`TESORERO`/`SECRETARIA` ya no existen en el enum, hace rato — el reemplazo por `MANAGER`/`USUARIO` + módulos delegables vía `AccesoModulo` no había quedado documentado); listado completo de rutas públicas (antes solo mencionaba una, hoy son 3). Nueva sección "Planes comerciales y facturación". Tabla de `Módulos` completada con `accesos`, `mi-iglesia`, `ceremonias` e `integrantes` (existían en el código pero no en el README). Nueva sección "Base de datos" documentando Supabase como proveedor. "Pendientes conocidos" actualizado (se quitó el ítem de `docker-compose` — ya existe — y se agregó la falta de pasarela de pago y la duda sobre el hosting de la API).
- `backend/TODO.md`: marcados como resueltos los ítems "definir estrategia comercial" (planes) y "módulo de roles para el pastor" (módulo `accesos`), y anotada la migración a Supabase.

**Funcionalidad:** el fundador notó que varias cosas que se habían implementado en sesiones/commits anteriores (el módulo de Accesos tipo IAM, `mi-iglesia`, Ceremonias/certificados) nunca quedaron reflejadas en la documentación técnica, además de lo de esta sesión (planes/facturación, Supabase). Esto deja `README.md` y `TODO.md` describiendo el sistema tal como está hoy, no como estaba hace varios commits.

## [2026-08-04 01:00] Nuevo documento: convenciones de commits (`github.md`)

**Cambios:** `github.md` (nuevo, raíz del repo) — guía de cómo hacer commits de ahora en adelante: un commit por cambio describible en una frase, `FEATURES.md` siempre commiteado junto al código que documenta, staging por ruta explícita (`git add -p` para dividir un mismo archivo entre commits), formato de mensaje (`tipo(alcance): resumen` + cuerpo con el porqué), reglas específicas para migraciones de Prisma contra Supabase (`migrate deploy`, nunca `migrate dev`, siempre commiteada junto a su `schema.prisma`), y un checklist pre-commit (lint/build/test/`migrate status`).

**Funcionalidad:** el historial de commits de este repo tiene mensajes genéricos (`"Add"`, `"Add new features"`) que mezclan módulos sin relación, lo que causó que trabajo real (Accesos, Ceremonias, mi-iglesia) quedara sin documentar y generó confusión sobre qué estaba realmente reflejado en la base de datos de Supabase. Este documento fija las reglas para que no se repita — es una guía de proceso, no de negocio ni técnica, por eso vive separado de `README.md`/`CLAUDE.md`.
