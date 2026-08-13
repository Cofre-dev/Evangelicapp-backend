
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

## [2026-08-08 21:35] Fase 1 de docs/supabase.md: Storage reemplaza el disco local para logos y fotos

**Cambios:**
- MCP de Supabase autenticado y verificado contra el proyecto `Backend` (`lkcgiqmgdefhxhckedga`) — estado `ACTIVE_HEALTHY`, no pausado (resuelve el bloqueador que había quedado pendiente en la entrada anterior).
- 3 buckets nuevos en Supabase Storage, todos públicos de lectura (decisión del fundador: igual nivel de exposición que hoy, `/uploads` se sirve sin auth): `logos-iglesias` (2 MB, solo PNG), `fotos-perfil` (2 MB, PNG/JPG/WEBP), `fotos-integrantes` (3 MB, PNG/JPG/WEBP).
- `src/supabase/` (nuevo módulo `@Global()`): `SupabaseStorageService`, cliente con la `service_role` key — sube/borra objetos sin depender de RLS (no hay Supabase Auth todavía, Fase 7 del plan).
- `logo-upload.config.ts`, `foto-perfil-upload.config.ts`, `foto-upload.config.ts`: `diskStorage` → `memoryStorage()`; cada uno expone `resolverExtension...(mimetype)` para nombrar el objeto en el bucket (reemplaza el `filename` que generaba multer).
- `iglesias.service.ts#create`, `mi-iglesia.service.ts#updateLogo`, `auth.service.ts#updateMiFoto`, `integrantes.service.ts#registrar`: ya no escriben a disco — suben al bucket correspondiente y guardan la URL pública en `logoUrl`/`fotoUrl`. Al reemplazar un logo/foto, se sube el nuevo antes de borrar el anterior (si la subida falla, no se pierde el logo existente).
- `certificado-pdf.builder.ts`: el logo de los certificados PDF ya no se lee de disco (`fs.existsSync`) — se descarga por HTTP desde la URL pública del bucket antes de dibujar el PDF; si la descarga falla, el certificado se genera igual sin logo (mismo comportamiento que un mimetype no soportado).
- `main.ts`: se quitó `app.useStaticAssets(...)` — `/uploads` ya no se sirve.
- `mail.service.ts`: el `<img>` del logo en el correo de convocatoria ya no asume una ruta relativa con `BACKEND_URL` como prefijo — usa la URL absoluta del bucket directo (con fallback al comportamiento viejo por si queda algún `logoUrl` sin migrar).
- `scripts/migrate-uploads-to-supabase.ts` (nuevo, `npm run migrate:uploads`): migración idempotente de los archivos que ya existían en `backend/uploads/{logos,perfiles,integrantes}` — los sube al bucket y actualiza la fila correspondiente en la BD activa. Corrida contra el Postgres local actual: 2 `Iglesia.logoUrl` migrados (0 `Usuario.fotoUrl`/`Integrante.fotoUrl`, ninguna fila los tenía asignados todavía).
- `.env.example` y `.env`: nuevas variables `SUPABASE_URL` (no secreta) y `SUPABASE_SERVICE_ROLE_KEY` (secreta — la pegó el fundador directamente en `.env`, nunca pasó por acá).
- Verificado de punta a punta contra el servidor real (no solo build/lint): login vía API, alta de iglesia con logo, reemplazo de logo (confirmado que borra el objeto viejo del bucket vía SQL), y el archivo migrado por el script confirmado públicamente accesible (`curl` → 200). Datos de prueba (2 iglesias QA + su objeto en el bucket) borrados al terminar.

**Funcionalidad:** el logo de la iglesia y las fotos de perfil/integrantes dejan de vivir en el disco del servidor (`backend/uploads/`), que es efímero en la mayoría de hosting — un redeploy en Railway/Render los borraba. Ahora persisten en Supabase Storage, aprovechando una pieza del plan Pro que se pagaba y no se usaba (ver `docs/supabase.md`). Sin cambio de comportamiento visible para el usuario final.

**Pendiente:** los archivos viejos en `backend/uploads/` (24 en total, la mayoría sin fila en la BD que los referencie) no se borraron del disco — quedaron ahí por si el fundador quiere revisarlos antes; siguen sin usarse por el código. `Usuario.fotoUrl`/`Integrante.fotoUrl` no tenían datos que migrar en esta corrida porque la BD local (seed de la entrada del 2026-08-07) no los había asignado — si se vuelve a correr `migrate:uploads` contra la BD de Supabase (cuando se retome como fuente de verdad), sí puede haber filas reales de esos dos campos por migrar. Fases 2 a 8 de `docs/supabase.md` siguen pendientes de tu OK explícito, una por una.

## [2026-08-08 22:10] Brief para frontend: logoUrl/fotoUrl pasaron a ser URLs absolutas

**Cambios:** `prompt.md` reescrito (estaba vacío) con el brief de la Fase 1 de arriba para el equipo de frontend: qué cambió en el formato de `logoUrl`/`fotoUrl` (de ruta relativa a URL absoluta de Supabase Storage), qué hay que corregir (dejar de prefijar esos valores con `API_URL`/`BACKEND_URL`) y qué no cambia (flujo de subida, nombres de campo). Incluye un caso concreto ya encontrado — `frontend/src/app/agenda/asistencia/[token]/page.tsx:104` construye el `src` de la imagen como `` `${API_URL}${data.iglesia.logoUrl}` ``, que con el nuevo formato queda roto — y la advertencia de que si usan `next/image` hay que sumar el dominio de Supabase (`lkcgiqmgdefhxhckedga.supabase.co`) a `images.remotePatterns` en `next.config.js`, sin lo cual la imagen no carga aunque se arregle la concatenación.

**Funcionalidad:** el repo de frontend vive aparte y solo tengo acceso a una carpeta puntual (`agenda/asistencia`) — este brief le da al equipo de frontend (o a una sesión de Claude en ese repo) el contexto completo del cambio de contrato de la Fase 1 sin tener que releer `docs/supabase.md` ni el diff del backend, más una lista concreta de dónde buscar en el resto del repo que no pude auditar yo mismo.

## [2026-08-09 00:00] Fase 2 de docs/supabase.md: resize/optimización de imagen al subir

**Cambios:**
- MCP de Supabase verificado antes de tocar código: proyecto `Backend` (`lkcgiqmgdefhxhckedga`) `ACTIVE_HEALTHY`, los 3 buckets de la Fase 1 siguen ahí. Esta fase no toca nada del lado de Supabase (ni buckets ni políticas) — confirma lo que ya anticipaba el doc: es trabajo puro de backend con `sharp`.
- `package.json`: nueva dependencia `sharp` (^0.35.3).
- `src/supabase/supabase-storage.service.ts`: `upload(...)` acepta ahora un 4to parámetro opcional `resize: ImageResizeOptions` (`{ width, height, fit }`). Si viene, el buffer se redimensiona y recomprime con `sharp` antes de subir al bucket — mismo mimetype/extensión de siempre (nunca se re-codifica a otro formato), nunca se agranda una imagen más chica que el objetivo (`withoutEnlargement`). Centralizado acá en vez de en los 4 call sites, para no duplicar la lógica.
- `logo-upload.config.ts`: nuevo `LOGO_RESIZE = { width: 512, height: 512, fit: 'inside' }` — `inside` (no `cover`) porque un logo no siempre es cuadrado y el certificado PDF ya lo centra en un círculo de 64×64 escalado (`certificado-pdf.builder.ts`), así que no hace falta forzar el cuadrado y recortar contenido.
- `foto-perfil-upload.config.ts` y `foto-upload.config.ts` (integrantes): nuevos `FOTO_PERFIL_RESIZE`/`FOTO_INTEGRANTE_RESIZE = { width: 256, height: 256, fit: 'cover' }` — acá sí se recorta a cuadrado exacto, son avatares de tamaño fijo en la UI.
- `iglesias.service.ts#create`, `mi-iglesia.service.ts#updateLogo`, `auth.service.ts#updateMiFoto`, `integrantes.service.ts#registrar`: pasan el resize correspondiente al llamar a `supabaseStorage.upload(...)`.
- Verificado con `sharp` real (no solo lint/build): una imagen 1200×800 baja a 512×341 con `fit: inside` (sin recorte, aspect ratio intacto) y a 256×256 exacto con `fit: cover`; una imagen ya más chica que el objetivo (100×100) queda igual, no se agranda.

**Funcionalidad:** subidas y cargas de imagen más rápidas (menos bytes por archivo, tanto al subir desde el navegador como al servir después) — el doc estimaba esto como "Bajo" riesgo y sin dependencia real de Supabase, y así resultó: no hubo que tocar nada en el proyecto de Supabase, solo backend. Sin cambio de comportamiento visible para el usuario más allá de la velocidad; los campos `logoUrl`/`fotoUrl` siguen teniendo el mismo formato (URL absoluta del bucket) que dejó la Fase 1.

**Pendiente:** las Fases 3 a 8 de `docs/supabase.md` siguen pendientes de tu OK explícito, una por una — la 3 (caché de PDFs) es la siguiente en la secuencia recomendada.

## [2026-08-09 23:20] Fase 3 de docs/supabase.md: caché de PDFs de certificados

**Cambios:**
- Bucket nuevo `certificados-ceremonias` en Supabase Storage — a diferencia de los 4 buckets anteriores, este es **privado** (`public: false`), 5 MB, solo `application/pdf`. Decisión propia no explicitada en el doc original: los certificados de ceremonias siempre se sirvieron por el endpoint autenticado (`JwtAuthGuard` + `iglesiaId` scoping), nunca por URL pública — contienen PII real (nombres completos, fechas de bautizo/matrimonio/defunción de personas reales). Hacerlo público habría sido una regresión de seguridad respecto al comportamiento actual, no una mejora de performance neutra.
- `src/supabase/supabase-storage.service.ts`: nuevo método `getOrGenerate(bucket, objectName, generate)` — descarga el objeto si ya existe (cache hit) o llama a `generate()`, sube el resultado (best-effort: si falla la subida, igual devuelve el PDF recién generado, no rompe la respuesta al usuario) y lo devuelve (cache miss). Refactor interno: `upload()` y `getOrGenerate()` comparten un `putObject()` privado.
- `src/modules/ceremonias/certificados/certificado-cache.util.ts` (nuevo): `resolverObjectNameCertificado({ tipo, id, actualizadoEn, logoUrl })` — nombre del objeto cacheado, hash de `id + updatedAt + logoUrl`. Cambia (invalidando el caché) si se edita el registro o si cambia el logo de la iglesia; deliberadamente NO usa `Iglesia.updatedAt` completo (cambia por cosas sin relación, como facturación, e invalidaría de más). Versiones viejas quedan huérfanas en el bucket sin cleanup activo — mismo criterio de tolerancia que el resto del storage, y confirmado que el volumen es bajo (ediciones de un certificado ya emitido son raras).
- `bautizos.service.ts`, `matrimonios.service.ts`, `defunciones.service.ts`, `presentaciones.service.ts` (`generarCertificado`): ahora envuelven la llamada a `generarCertificadoPdf(...)` en `supabaseStorage.getOrGenerate(...)`, cada uno inyectando `SupabaseStorageService`.
- Verificado de punta a punta contra el servidor real: 1ra descarga de un certificado (bautizo de prueba) generó el PDF y lo subió (~2s); 2da descarga sirvió el mismo PDF desde el bucket, byte a byte idéntico (~0.8s, sin volver a llamar a `pdfkit`). Al editar el registro, la 3ra descarga generó un PDF distinto (confirma invalidación) y el objeto viejo quedó huérfano en el bucket junto al nuevo. Confirmado también que el bucket rechaza lectura pública sin auth (`400` al pedir `/object/public/...`). Datos y objetos de prueba borrados al terminar (el borrado de `storage.objects` está bloqueado a nivel de trigger para SQL directo — Supabase fuerza pasar por la Storage API, que es exactamente lo que ya hace `removeByPublicUrl`/este cleanup).

**Funcionalidad:** las descargas de certificados repetidas (alguien vuelve a bajar el mismo certificado, o lo reimprime) dejan de regenerar el PDF con `pdfkit` cada vez — se sirven desde el bucket. La 2da descarga en adelante es más rápida.

**Cambio de comportamiento discutido explícitamente con el fundador (no es un efecto secundario silencioso):** el código ya tenía una regla intencional — "la fecha de emisión no se persiste, es siempre 'hoy': una reimpresión trae la fecha en que se reimprime" (`certificado-pdf.builder.ts`). Con el PDF completo cacheado, esa fecha queda fija en el momento en que se generó esa versión, no se actualiza en cada descarga. Se le presentó la disyuntiva con 4 opciones (dejarlo así / usar `createdAt` del registro / no cachear ese campo / expirar el caché cada 24h) y **eligió dejarlo así**: la fecha de emisión ahora significa "cuándo se generó esta versión del PDF", no "cuándo se hizo click en descargar" — sigue siendo veraz, solo cambia su semántica. La fecha real de la ceremonia (bautizo/matrimonio/etc.), que es la que importa legalmente, sigue siempre correcta en el cuerpo del certificado — no depende del caché. Comentario del código actualizado para reflejar esto.

**Pendiente:** Fases 4 a 8 de `docs/supabase.md` siguen pendientes de tu OK explícito — la 4 (cron de recordatorios) es la siguiente en la secuencia, y necesita que definas la regla de negocio (cuántos días antes avisar) antes de empezar.

## [2026-08-09 23:35] Brief para frontend: caché de certificados (Fase 3)

**Cambios:** `prompt.md` reescrito con el brief de la Fase 3 de arriba: aclara que no hay ninguna acción requerida (mismo contrato de API, mismo PDF, solo más rápido en descargas repetidas), qué es y por qué el bucket de certificados es privado (a diferencia de los de logos/fotos), y el detalle de que la "fecha de emisión" del PDF ahora queda fija por certificado cacheado en vez de actualizarse en cada descarga — por si afecta algún texto de la UI, sin ser una acción obligatoria.

**Funcionalidad:** el repo de frontend vive aparte; este brief evita que tengan que releer `docs/supabase.md` o el diff del backend para entender que esta fase no les toca ningún código, y les da el contexto del único cambio de contenido (no de contrato) que trae el PDF por si lo necesitan para copy o soporte.

## [2026-08-10 00:50] Fase 4 de docs/supabase.md: recordatorios de facturación + historial de pagos + fecha de adquisición del plan

Esta fase salió más grande que el ítem original del doc — el fundador aprovechó para pedir 3 cambios de negocio nuevos sobre el módulo de facturación, además del cron de recordatorios en sí. Antes de escribir código se le preguntó explícitamente cómo confirmar el cambio de fecha de facturación (ver más abajo) — el resto de las decisiones de diseño quedaron a mi criterio y están documentadas acá.

**Cambios — modelo de datos:**
- `prisma/schema.prisma`: nuevo modelo `PagoIglesia` (`pagos_iglesia`) — `iglesiaId`, `fecha`, `registradoPorId` (SetNull si se borra el usuario). Sin campo de monto: el modelo de precios/monetización sigue sin definir (ver `CLAUDE.md`), agregar cuando exista un valor real que registrar. Migración `20260810042939_add_pago_iglesia_historial`.

**Cambios — alta de iglesia y fecha de facturación:**
- `CreateIglesiaDto`: el campo `proximaFacturacion` (que el SuperAdmin elegía a mano) se reemplaza por `fechaAdquisicionPlan`. `IglesiasService#create` calcula `proximaFacturacion = fechaAdquisicionPlan + 30 días` (nuevo util `sumarDias` en `calcular-facturacion.ts`) y, en la misma transacción, crea la primera fila de `PagoIglesia` con esa fecha — adquirir el plan cuenta como el primer "pago" del historial.
- `IglesiasService#marcarPagada`: además de avanzar la fecha un mes (comportamiento que ya existía), ahora también inserta una fila en `PagoIglesia` en la misma transacción.
- Nuevo endpoint `GET /iglesias/:id/historial-pagos` (SuperAdmin): lista de `PagoIglesia` de la iglesia, más reciente primero, con quién lo registró.
- `ActualizarFacturacionDto` (`PATCH /iglesias/:id/facturacion`, corrección manual de la fecha) ahora exige `password` — reingresar la contraseña del SuperAdmin, mismo patrón que `ConfirmPasswordDto` ya usa para borrar certificados. **Se le preguntó explícitamente al fundador** cómo quería esta confirmación (contraseña / flag simple `confirmado: true` / solo UI sin backend) y eligió reingresar contraseña. Este endpoint NO crea fila de historial — es una corrección de dato, no una confirmación de pago.
- `IglesiasController#create`/`marcarPagada`/`actualizarFacturacion` ahora reciben `@CurrentUser()` para saber qué SuperAdmin registra el pago o confirma el cambio.

**Cambios — cron de recordatorios:**
- Nueva dependencia `@nestjs/schedule`, registrada en `AppModule` (`ScheduleModule.forRoot()`). Decisión propia, distinta a lo que sugería el doc original (Edge Function de Supabase): el backend ya corre siempre activo en Render (no serverless), así que un cron dentro del propio proceso Nest reutiliza `MailService` directo sin exponer un endpoint interno ni duplicar lógica de envío en Deno — menos piezas, mismo resultado.
- `src/modules/iglesias/facturacion-recordatorios.cron.ts` (nuevo): corre una vez al día (`EVERY_DAY_AT_9AM`), recorre todas las iglesias y por cada una calcula su semáforo (`calcularEstadoFacturacion`, ya existente). Reglas de negocio (definidas por el fundador):
  - `diasParaFacturacion === 7` → correo preventivo (`MailService#enviarRecordatorioFacturacion`).
  - `enMora && diasEnMora` impar → correo de mora, día por medio (1, 3, 5, 7... días vencida, no todos los días) (`MailService#enviarFacturacionVencida`, copy: "tu facturación venció hace X días, favor ponerse al día...").
  - Ambas condiciones son "es exactamente hoy", sin ningún estado persistido de "ya se avisó" (mismo criterio stateless que el semáforo) — si el cron no corre justo ese día (redeploy, caída puntual), ese aviso puntual se pierde sin reintento. Riesgo aceptado y documentado en el propio archivo: es un aviso de cortesía, no lo que corta el acceso (eso lo sigue haciendo `IglesiasService#ocultar`, sin cambios).
  - El destinatario es el email del `MANAGER` activo de la iglesia (dueño del tenant).
- `MailService`: 2 templates nuevos (`enviarRecordatorioFacturacion`, `enviarFacturacionVencida`), mismo patrón best-effort que los templates existentes (catch + log, un fallo de envío no tumba la corrida del cron para el resto de las iglesias).

**Cambios — alertas en frontend:** ninguno del lado backend además de lo de arriba. `GET /mi-iglesia/facturacion` (existente desde el 2026-08-03) ya devuelve todo lo necesario (`diasParaFacturacion`, `color`, `enMora`, `diasEnMora`) para que el frontend arme el modal de 3 días y el aviso de mora — no hizo falta agregar ni cambiar ningún campo ahí. El detalle completo de qué construir queda en el brief de `prompt.md`.

**Verificado de punta a punta contra el servidor real y el cron real (invocado directo vía contexto de Nest, no solo esperando al horario programado):**
- Alta de iglesia con `fechaAdquisicionPlan: "2026-08-10"` → `proximaFacturacion` calculada correctamente en `2026-09-09` y primera fila de historial creada.
- `PATCH .../facturacion` sin password → 400 de validación; con password incorrecta → 401 "Contraseña incorrecta"; con password correcta → cambia la fecha y el historial NO crece.
- `POST .../marcar-pagada` → avanza un mes exacto y agrega una fila al historial; `GET .../historial-pagos` la devuelve.
- Cron: con `proximaFacturacion` a exactamente 7 días, dispara el recordatorio preventivo (confirmado el intento de envío real contra Resend — lo rechazó por la restricción de modo test de la cuenta, no por un bug del código). Con 3 días de mora (impar) dispara el aviso de vencida; con 2 días de mora (par) no envía nada — confirma la lógica de "día por medio".
- Datos de prueba (iglesia, usuario, pagos) borrados al terminar.

**Funcionalidad:** el SuperAdmin ya no elige a mano la primera fecha de facturación (posible fuente de error humano) — solo confirma cuándo la iglesia adquirió el plan y el sistema calcula el resto. Cambiar esa fecha después queda protegido con una confirmación real (contraseña), no solo un click. El historial de pagos le da trazabilidad completa de cuándo se confirmó cada pago y quién lo hizo — antes solo se guardaba el último (`ultimoPagoAt`). Y las iglesias dejan de enterarse de su propio vencimiento solo cuando el SuperAdmin las oculta por mora: reciben aviso preventivo y luego recordatorios regulares mientras estén vencidas.

**Pendiente:** Fases 5 a 8 de `docs/supabase.md` siguen pendientes de tu OK explícito — la 5 (Realtime) es la siguiente en la secuencia, y ya el doc advertía que conviene esperar a que la Fase 8 (RLS) esté lista antes de activarla para iglesias reales. El frontend tiene que construir el modal/alertas — nada de eso existe todavía del lado de la UI, ver brief.

## [2026-08-10 01:05] Brief para frontend: fecha de adquisición, historial de pagos, confirmación y alertas (Fase 4)

**Cambios:** `prompt.md` reescrito con el brief de la Fase 4 de arriba, en 4 secciones: (1) el rename `proximaFacturacion` → `fechaAdquisicionPlan` en el alta de iglesia, que rompe el formulario actual del SuperAdmin; (2) el nuevo campo `password` obligatorio en `PATCH /iglesias/:id/facturacion`, con los 3 casos de error a manejar; (3) el contrato del nuevo `GET /iglesias/:id/historial-pagos` y una propuesta de tabla simple para mostrarlo; (4) una propuesta concreta de UX para el modal de 3 días y el banner de mora, dejando explícito que no hace falta ningún endpoint nuevo — `GET /mi-iglesia/facturacion` (existente) ya trae todo (`diasParaFacturacion`, `color`, `enMora`, `diasEnMora`).

**Funcionalidad:** a diferencia de los briefs de las Fases 1-3 (mayormente informativos, "no tienen que hacer nada"), esta fase sí requiere trabajo real de UI que yo no puedo hacer (fuera del alcance de mi acceso al repo de frontend) — el brief da el contrato exacto de cada endpoint nuevo/cambiado más una propuesta de copy y de cuándo mostrar cada alerta, para que el equipo de frontend (o una sesión de Claude en ese repo) pueda implementarlo sin tener que adivinar la regla de negocio ni releer el diff del backend.

## [2026-08-11 13:44] KPIs de landing para SuperAdmin y Manager/Usuario + página "Iglesias" + tracking de actividad

Pedido del fundador: que el SuperAdmin vea KPIs (iglesias, usuarios activos, picos de
actividad, certificados emitidos) apenas entra a la app, con una página aparte para
navegar/filtrar iglesias y ver su detalle; y que Manager/Usuario tengan su propio landing con
KPIs de su iglesia y tiempo de uso. Antes de escribir código se le preguntó explícitamente cómo
medir actividad/tiempo de uso (no existía ningún tracking, solo `RefreshToken`) y cómo definir
"certificado emitido" — eligió heartbeat ligero desde el frontend y contar registros de
ceremonias (Matrimonio/Bautizo/Defuncion/Presentacion) respectivamente. El resto de las
decisiones de diseño (qué KPIs, qué se excluye, cómo particionar los endpoints) quedó a mi
criterio, documentado abajo.

**Cambios — schema (tracking de actividad):**
- `prisma/schema.prisma`: nuevo modelo `SesionActividad` (`sesiones_actividad`) —
  `usuarioId`, `iglesiaId` (null solo para SUPER_ADMIN), `inicioAt`, `ultimoLatidoAt`, `finAt?`.
  Nuevo campo `Usuario.ultimoAccesoAt` (denormalizado, para que "usuarios activos" sea un
  `count()` directo). Migración `20260811173324_add_sesion_actividad`.
- `AuthService#login` abre una `SesionActividad` y setea `ultimoAccesoAt`. Nuevo
  `AuthService#heartbeat` (usado por `POST /auth/heartbeat`, `204`, sin body) actualiza
  `ultimoLatidoAt` de la sesión abierta más reciente. `AuthService#refreshTokens` hace el mismo
  bump best-effort (respaldo si el heartbeat del frontend falla). `AuthService#logout` cierra
  (`finAt`) las sesiones abiertas del usuario. Una sesión abandonada (se cierra la pestaña sin
  logout) no se expira a mano — su último latido ya es su fin real de uso, no hacía falta más.

**Cambios — helper compartido:**
- `common/utils/bucket-por-mes.util.ts` (nuevo): `bucketPorMes`/`inicioVentanaMensual` agrupan
  fechas en baldes mensuales calendario (UTC), rellenando con 0 los meses sin datos. Usado por
  los 3 endpoints de abajo que traen series "por mes" — evita triplicar el mismo date-math.

**Cambios — `GET /superadmin/dashboard` (mismo endpoint, payload más rico):**
- `totales` suma `iglesiasSuspendidas`, `usuariosActivosHoy`/`usuariosActivosSemana` (excluyen
  SUPER_ADMIN a propósito: miden adopción de iglesias, no uso interno del operador) y
  `certificadosEmitidos`. `porPlan` nuevo (mismo patrón que `porRegion`, ya existente).
  `certificados` (por tipo + por mes, 6 meses) y `actividad` (por día 30 días, por hora 0-23
  agregada, tiempo promedio de sesión) nuevos.
- El campo `iglesias` (listado completo embebido) se reemplaza por `iglesiasRecientes` (últimas
  5) — **breaking change**, documentado en el brief de frontend. El listado completo/filtrable
  se mueve al endpoint nuevo de abajo.

**Cambios — `GET /iglesias` (nuevo) y `GET /iglesias/:id` (enriquecido):**
- `IglesiasController`/`Service#findAll` (nuevo): listado para la página "Iglesias", filtros
  `search`/`estado`/`plan`/`region`, sin paginación (mismo criterio que el resto del backend:
  bajo volumen, no introducir el patrón solo acá).
- `IglesiasService#buildDetalle` (ya existía) suma un bloque `estadisticas`: usuarios activos,
  eventos, integrantes, certificados (total/por tipo/por mes) y notas pendientes de esa
  iglesia. Deliberadamente **sin nada financiero** — el SuperAdmin no ve el detalle
  financiero/operativo interno de una iglesia (ver `CLAUDE.md`), así que ese bloque no incluye
  montos ni movimientos, solo counts de adopción/uso.

**Cambios — `GET /dashboard` (módulo nuevo, `src/modules/dashboard/`):**
- Landing para MANAGER/USUARIO (no existía ninguno) — sin MIEMBRO (sin funcionalidad propia
  todavía) ni SUPER_ADMIN (tiene el suyo). No vive en `mi-iglesia` porque ese módulo es
  exclusivo de MANAGER y USUARIO también necesita este landing.
- Replica la regla de `ModuloAccessGuard` (MANAGER ve todo; USUARIO solo los módulos que tenga
  otorgados vía Accesos) pero sección por sección en vez de todo-o-nada: cada bloque
  (`agenda`/`ceremonias`/`integrantes`) viene `null` si no corresponde, en vez de rechazar el
  endpoint completo. `equipo` (actividad del propio equipo) solo para MANAGER. `personal`
  (tiempo de uso propio + tareas asignadas) siempre viene, para cualquiera de los dos roles.
- Finanzas queda deliberadamente fuera: el frontend sigue pegando directo a `GET
  /finanzas/movimientos/dashboard` (ya existente), que ya se autogestiona el permiso por
  módulo — duplicar esa lógica acá era innecesario.

**Verificado de punta a punta contra el servidor local (Postgres de Docker) y el seed real:**
typecheck (`tsc --noEmit`) y lint (`eslint --fix`) limpios. Flujo real con curl: login pastor
→ cambio de contraseña temporal → heartbeat → `GET /dashboard` (bloques `agenda`/`ceremonias`/
`integrantes`/`equipo` presentes para MANAGER, `personal.tiempoHoyMinutos` reflejando el
heartbeat recién hecho) → `GET /finanzas/movimientos/dashboard` sigue funcionando aparte, sin
tocar. Login SuperAdmin → `GET /superadmin/dashboard` (`usuariosActivosHoy: 1`, excluyendo al
propio SuperAdmin logueado) → `GET /iglesias` y `GET /iglesias?search=...` (filtro por nombre
funcionando) → `GET /iglesias/:id` con el bloque `estadisticas` nuevo, confirmado visualmente
sin ningún campo financiero. Cuenta demo (`jperez`) restaurada a su estado de primer login
corriendo el seed de nuevo al terminar.

**Funcionalidad:** el SuperAdmin ahora ve, apenas entra, un panorama real de la plataforma
(cuántas iglesias activas/en mora, cuánta gente la usa, cuántos certificados se emiten, a qué
horas se usa más) en vez de una pantalla en blanco, más una página dedicada para navegar y
filtrar iglesias con su detalle de adopción/uso. El Manager y su equipo (Usuario) tienen por
primera vez un landing con KPIs de su propia iglesia y su tiempo de uso personal, acotado a lo
que cada uno tiene permitido ver. Nada de esto tiene todavía interfaz — el frontend vive en
otro repo, ver brief abajo.

## [2026-08-11 13:50] Brief para frontend: dashboards, página "Iglesias" y skills de diseño

**Cambios:** `prompt.md` (raíz del repo) reescrito con el brief completo de arriba: los 2
comandos para instalar las skills de diseño (`anthropics/skills --skill frontend-design` y
`vercel-labs/agent-skills --skill web-design-guidelines`) con instrucción explícita de usarlas
para rediseñar las 3 pantallas nuevas/cambiadas (landing SuperAdmin, página Iglesias, landing
Manager/Usuario) para que dejen de verse genéricas; el contrato completo (JSON de ejemplo real,
sacado del smoke test) de cada endpoint nuevo/cambiado con el breaking change de
`GET /superadmin/dashboard` resaltado; el requisito de comportamiento del heartbeat (cada 60s,
Page Visibility API, solo pasado el gate de password/onboarding); sugerencias de layout por
pantalla; y el recordatorio explícito de no agregar nada financiero al detalle de iglesia del
SuperAdmin aunque el resultado de la skill de diseño lo sugiera.

**Funcionalidad:** el repo de frontend vive aparte (solo tengo acceso a una carpeta puntual,
`agenda/asistencia`) — este brief le da a quien trabaje ahí (persona o una sesión de Claude en
ese repo) todo lo necesario para implementar las 3 pantallas y el heartbeat sin tener que leer
el diff del backend ni adivinar los contratos, las reglas de acceso por módulo o el límite de
qué puede/no puede mostrarse en cada vista.

## [2026-08-12 13:35] Brief para frontend: notas largas y alerta de mensualidad solo el día del vencimiento

**Cambios:** `prompt.md` (raíz del repo) reescrito con dos pedidos del fundador, ambos sin
tocar el backend — confirmé que `descripcion` de `Nota` no tiene límite de longitud ni
validación que bloquee la edición (`create-nota.dto.ts`/`update-nota.dto.ts`), así que el
overflow de notas largas y el que "no deje editarlas" es un bug de la UI (probablemente el
mismo botón de editar tapado por el overflow, o el `textarea` de edición truncando el texto
en el estado). El brief pide: truncar en el listado con "ver más", `textarea` completo en la
edición, y un confirm simple sí/no antes de editar — explícitamente **sin contraseña** (no
reusar el patrón de `ConfirmPasswordDto` que se usa para cambiar la fecha de facturación). El
segundo punto revisa la propuesta de UX del brief anterior (Fase 4, entrada del 2026-08-11):
el modal de aviso de facturación pasa de dispararse `diasParaFacturacion <= 3` a solo
`diasParaFacturacion === 0` (el mismo día que vence, no antes) porque el aviso anticipado le
resultó molesto al usuario final; el banner de mora (`enMora === true`) y la cadencia de
correos automáticos del cron (`FacturacionRecordatoriosCron`, 7 días antes + cada 2 días en
mora) quedan sin cambios — el pedido fue explícitamente sobre el aviso in-app.

**Funcionalidad:** ajusta dos fricciones reportadas por el fundador tras usar la plataforma
con datos reales: notas largas rotas visualmente y sin poder editarse, y una alerta de cobro
que avisaba con demasiada anticipación y se sentía invasiva. Ninguno de los dos requería
cambios de backend — el brief documenta el diagnóstico para que el frontend no pierda tiempo
buscando un endpoint o validación que no existe.

## [2026-08-13 17:30] Fase 5 de docs/supabase.md: Realtime propio (WebSocket) para las 3 pantallas — no Supabase Realtime nativo

Pedido del fundador: implementar la Fase 5 del plan (Realtime en dashboard SuperAdmin,
pantalla de evento del Pastor y censo en vivo). Antes de escribir código señalé un conflicto
real con lo que el propio `docs/supabase.md` documentaba: Supabase Realtime nativo
(`postgres_changes`) transmite a cualquier cliente con la anon key pública salvo que RLS esté
activo filtrando fila por fila — y RLS (Fase 8) no existe todavía, depende de un claim
`iglesia_id` en el JWT de Supabase Auth (Fase 7), que tampoco existe. Prender
`postgres_changes` hoy habría expuesto eventos/integrantes de cualquier iglesia a cualquier
cliente, rompiendo la garantía de aislamiento multi-tenant que `CLAUDE.md` marca como
innegociable. Se le presentaron 3 caminos (WebSocket propio, Supabase Realtime limitado a una
iglesia de prueba, o esperar a las Fases 7-8) y eligió el primero.

**Cambios — dependencias:** `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`
(`^10.4.22`/`^4.8.3`, alineadas a la versión de `@nestjs/common` ya instalada).

**Cambios — módulo `src/modules/realtime/` (nuevo):**
- `realtime.gateway.ts`: un único `WebSocketGateway` (no uno por pantalla) para las 3
  pantallas. Autentica cada conexión con el MISMO `access_token` (cookie httpOnly) que ya usa
  el resto de la API — reutiliza `JwtService`/`JWT_ACCESS_SECRET`, mismo secreto que
  `JwtStrategy`. El scoping por tenant lo decide el servidor, nunca el cliente: en
  `handleConnection`, si el rol es `SUPER_ADMIN` el socket se une a la room `superadmin`; si
  tiene `iglesiaId`, se une a `iglesia:{iglesiaId}`. Mismo criterio mínimo que
  `JwtStrategy.validate()` (usuario activo, iglesia no suspendida) revalidado una sola vez al
  conectar — un socket que sigue abierto no se corta a mitad de conexión si el usuario se
  desactiva después (limitación aceptada, documentada en el propio archivo). Cookie leída a
  mano del header crudo del handshake (`cookie-parser` no engancha ahí), con
  `handshake.auth.token` como fallback.
- `realtime.service.ts`: capa fina sobre el `Server` de socket.io (`emitAIglesia`/
  `emitASuperAdmin`) para que las services de negocio emitan eventos sin importar nada de
  `@nestjs/websockets` ni conocer el Gateway.
- `realtime-rooms.util.ts`: nombres de rooms/eventos compartidos.
- `common/utils/cors-origins.util.ts` (nuevo, extraído de `main.ts`): mismo parseo de
  `CORS_ORIGIN` reusado por el CORS del gateway.

**Cambios — 3 emisores wireados a las services existentes (nada de lógica de negocio nueva, solo el emit al final):**
- `IglesiasService`: `iglesia:actualizada` a la room `superadmin` en
  `marcarPagada`/`ocultar`/`mostrar`/`actualizarFacturacion` — los 4 puntos donde cambia
  `EstadoIglesia` o `proximaFacturacion`. Payload con el mismo shape que un item de
  `GET /iglesias` (refactoricé el mapeo de `findAll` a un método compartido `mapListado` para
  no duplicarlo).
- `PredicadoresService#responder`: `predicador:respondio` a la room de la iglesia del evento
  cuando el predicador confirma/rechaza desde el link público del email.
- `IntegrantesService#registrar`: `integrante:registrado` a la room de la iglesia, solo en el
  path de creación real (no cuando el registro es un duplicado por email/RUN ya existente).

**Verificado de punta a punta contra el servidor local (Postgres de Docker) con un cliente
socket.io real:** typecheck y lint limpios. Conexión sin token → rechazada. Conexión con token
de `admin` (SUPER_ADMIN) y de `jperez` (MANAGER) → aceptadas y persistentes. Con ambos sockets
conectados en paralelo: `POST /agenda/predicadores/:token/responder` (público) → el socket del
pastor recibe `predicador:respondio`, el del admin NO recibe nada (confirma que la room
`iglesia:*` no es visible desde `superadmin`); `POST /integrantes/registro/:qrToken` (público)
→ el socket del pastor recibe `integrante:registrado`; `POST /iglesias/:id/marcar-pagada` → el
socket del admin recibe `iglesia:actualizada` con el shape esperado, el del pastor no recibe
nada. Datos de prueba (evento, predicador, integrante, pago) borrados y cuenta demo (`jperez`)
restaurada a su estado de primer login corriendo el seed de nuevo al terminar. Encontré y
maté de paso un proceso `node dist/main` huérfano de una sesión de hace 2 días que seguía
ocupando el puerto 3001 — no relacionado con este cambio, pero bloqueaba poder probar.

**Pendiente:** el trabajo de frontend (repo aparte, `supabase-js`/`socket.io-client` en las 3
pantallas) queda fuera de este repo — ver brief en `prompt.md`. Fases 6-8 de
`docs/supabase.md` (webhook de pagos, Auth, RLS) siguen sin empezar.
