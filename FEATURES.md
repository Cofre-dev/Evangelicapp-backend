
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

## [2026-08-14 01:10] Fase 7 de docs/supabase.md (arranque): login por email + espejo a Supabase Auth en "convivencia temporal"

Pedido del fundador: implementar la Fase 7 (Auth). El propio `docs/supabase.md` la marca como
la fase de mayor riesgo del plan completo (XL, Alto riesgo) — toca el login y las sesiones de
iglesias reales que ya usan la plataforma. Antes de escribir código le presenté 3 decisiones
abiertas que el doc dejaba sin resolver y confirmó:

1. **Migración de usuarios existentes:** convivencia temporal de ambos sistemas (no reset
   forzado de contraseñas, no migrar solo una iglesia de prueba).
2. **Login:** pasar de `username` a `email` (alineado con el modelo nativo de Supabase Auth).
3. **Entorno de prueba:** proyecto de Supabase nuevo y desechable, no un branch del proyecto
   real ni probar directo contra producción.

**Alcance de esta entrada — deliberadamente conservador:** de los 9 pasos que
`docs/supabase.md` listaba para la Fase 7, esta entrada cubre la base segura (mapeo de
usuarios + login por email + mecanismo de espejo) sin tocar todavía la emisión de sesión real
(`JwtStrategy`/`LocalStrategy` siguen siendo el JWT/bcrypt propio de siempre — Supabase Auth
NO emite ni valida ninguna sesión todavía). Cortar la sesión real a Supabase Auth
(`JwtStrategy` completo, cookies/CSRF, `AccesoModulo` como custom claim, invitaciones) es un
paso posterior y separado, a confirmar explícitamente antes de tocarlo — consistente con la
recomendación del propio doc de no migrar en caliente sin haber probado de punta a punta.

**Cambios — proyecto de Supabase de prueba:**
- Proyecto nuevo `Backend-auth-test` (`grcywqjcqwpbuekqbupj`, `ca-central-1`, org
  `EvangelicApp`), creado vía MCP, costo confirmado en $0/mes. Completamente aislado del
  proyecto real (`Backend`, `lkcgiqmgdefhxhckedga`) que ya tiene datos reales de iglesias vía
  Storage — nunca comparten credenciales.

**Cambios — schema:**
- `Usuario.supabaseUserId String? @unique` (nullable): null hasta el primer login exitoso de
  ese usuario tras este cambio. Migración `20260814050100_add_supabase_user_id_to_usuario`.

**Cambios — `src/supabase/supabase-auth.service.ts` (nuevo):**
- Cliente de Supabase separado (`SUPABASE_AUTH_TEST_URL`/`SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY`,
  **opcionales** a propósito) apuntando SOLO al proyecto de prueba — nunca al de Storage.
  Sin esas variables configuradas, el servicio es un no-op silencioso (log de warning al
  arrancar): cualquiera en el equipo puede seguir corriendo el backend local sin tener que dar
  de alta una cuenta de prueba de Supabase Auth solo para levantar el server.
- `mirrorUsuario(usuario, password)`: crea el usuario en `auth.users` del proyecto de prueba
  (`admin.createUser`, con `usuarioId`/`rol`/`iglesiaId` como `app_metadata`) y guarda el
  `supabaseUserId` devuelto. No-op si ya estaba espejado.

**Cambios — login por email:**
- `LoginDto`: `username` → `email` (`@IsEmail()`). `LocalStrategy`: `usernameField: 'email'`.
  `AuthService#validateUser` ahora busca por `email`, no por `username` (`username` sigue
  existiendo en el modelo — display/creación de cuentas — pero deja de ser la credencial de
  login). **Breaking change para el frontend**, ver brief en `prompt.md`.
- `AuthService#validateUser`, justo después de confirmar la contraseña y de que la iglesia no
  esté suspendida (mismo punto, y único punto, donde el backend tiene el password en texto
  plano): dispara `supabaseAuth.mirrorUsuario(...)` sin `await` (fire-and-forget, con
  `.catch` que solo loguea) — un fallo del espejo no puede tumbar ni enlentecer un login real
  bajo ninguna circunstancia.

**Verificado contra el servidor local (Postgres de Docker):** typecheck y lint limpios.
`POST /auth/login` con `{ email, password }` → 200, cookies seteadas igual que siempre,
`supabaseUserId: null` en la respuesta (proyecto de prueba todavía sin configurar en este
entorno — confirma el no-op seguro). `POST /auth/login` con el body viejo (`{ username,
password }`) → 401, igual que credenciales inválidas — importante para el frontend, no es un
400 de validación porque Passport intercepta antes que el ValidationPipe.

**Verificación end-to-end del espejo, ya cerrada:** el fundador pasó la `service_role key` de
`Backend-auth-test` (no se puede obtener vía MCP — por diseño, solo expone keys públicas).
Con `SUPABASE_AUTH_TEST_URL`/`SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY` configuradas: login real de
`jperez` (`pastor@demo.cl`) → `supabaseUserId` se persiste en la fila de `Usuario` (confirmado
por Prisma) y aparece en `auth.users` del proyecto de prueba con `app_metadata` correcto
(`rol: MANAGER`, `iglesiaId: igl_demo`, `usuarioId` apuntando de vuelta a nuestra fila,
`email_confirmed_at` seteado). Un segundo login del mismo usuario confirmó la idempotencia:
sigue habiendo una sola fila en `auth.users` para ese email, no se duplica.

**Pendiente de esta misma fase:**
- Pasos 3-9 del plan original de Fase 7 (reemplazar `JwtStrategy` de verdad, guard de
  `activo`/`SUSPENDIDA`/`mustChangePassword`, `AccesoModulo` como custom claim, rotación de
  refresh tokens, cookies/CSRF vía Supabase, invitaciones, frontend con `supabase-js`) — sin
  empezar, a la espera de que esta base (mapeo + espejo, ya validada de punta a punta) reciba
  el visto bueno para seguir avanzando.
- Fase 6 (webhook de pagos) sigue bloqueada — modelo de negocio pendiente. Fase 8 (RLS) sigue
  dependiendo de que la Fase 7 se termine de verdad, no solo de esta base.

## [2026-08-14 01:35] Corrección de documentación: el proyecto está pre-lanzamiento, sin iglesias reales todavía

El fundador notó que `CLAUDE.md` y `docs/supabase.md` daban a entender, en varios lugares, que
ya había iglesias reales usando la plataforma (lenguaje como "usuarios reales", "iglesias que
ya usan la plataforma", justificando cautela en Fases 5 y 7). Confirmó explícitamente: **el
proyecto está en pre-lanzamiento total** — ninguna iglesia real lo usa hoy, todo lo que existe
en la base (incluida "Iglesia Evangélica Demo" y las otras 2 del seed) es data de prueba. Ha
habido demos puntuales (ej. a inversionistas) pero no clientes activos.

**Cambios — `CLAUDE.md`:** nueva sección "Estado actual: pre-lanzamiento" (entre "Qué es" y
"Problema que resuelve") explicando esto y por qué la cautela de ingeniería se mantiene igual
(el objetivo de largo plazo, no un riesgo de negocio actual). Ajustada la frase de
"Confiabilidad sobre velocidad" para no afirmar en presente algo que todavía no es cierto.

**Cambios — `docs/supabase.md`:** nota de estado agregada al inicio, apuntando a la sección
nueva de `CLAUDE.md`. Los 2 bloqueadores ya resueltos (MCP sin autenticar, proyecto pausado)
quedaron marcados como tal en vez de seguir listados como pendientes. Las recomendaciones de
Fase 5 y Fase 7 que hablaban de "iglesias reales"/"usuarios reales de una iglesia" se
corrigieron para reflejar que hoy no hay ninguna en riesgo, sin perder la disciplina de
cautela pensando en cuando sí las haya.

**Funcionalidad:** documentación desactualizada sobre algo tan básico como "¿hay clientes
reales hoy?" puede llevar a sobre-cautela innecesaria (o, peor, a asumir mal lo contrario) en
decisiones futuras — especialmente relevante ahora que la Fase 7 (Auth) sigue en curso y las
próximas decisiones (cutover de sesión, RLS) son justamente las que más se benefician de saber
con certeza si hay o no datos reales de por medio.

## [2026-08-14 01:35] Fase 7, paso 3: verificación de JWT de Supabase Auth (infraestructura aislada, sin cortar el login todavía)

El fundador confirmó avanzar con los pasos 3-9 de la Fase 7 (dejando la pasarela de pagos,
Fase 6, para el final) y pidió ir de a un paso a la vez, con autorización explícita entre
cada uno — sensato incluso sabiendo que el proyecto está pre-lanzamiento (ver entrada
anterior), porque el corte final sigue necesitando coordinación con el frontend.

**Decisión de secuenciación:** a diferencia de Fases 1-5 (aditivas), los pasos 3-9 son un solo
cambio grande y acoplado — no se puede "cortar" el login real (paso 3 del doc) sin haber
resuelto antes las validaciones por-request (paso 4) y el resto. Cada paso de aquí en adelante
se construye como infraestructura que corre en paralelo al sistema actual, sin tocar el login
real ni ningún guard activo, hasta que todo esté listo para un corte final explícito
(coordinado con el frontend).

**Este paso — verificar un JWT emitido por Supabase Auth:**
- Confirmé contra `/auth/v1/.well-known/jwks.json` del proyecto de prueba que usa signing keys
  asimétricas (ES256) — la documentación de Supabase recomienda verificar vía JWKS con una
  librería como `jose` en ese caso (y explícitamente desaconseja verificar a mano con un
  secreto compartido en el modelo legacy HS256, que acá no aplica).
- Nueva dependencia: `jose` (recomendada por la propia documentación de Supabase para esto).
- `src/supabase/supabase-jwt-verifier.service.ts` (nuevo): `verifyAccessToken(token)` verifica
  firma/expiración/issuer vía JWKS remoto (cacheado, sin round-trip a Supabase en cada
  verificación) y resuelve el token de vuelta a nuestra fila de `Usuario` vía
  `app_metadata.usuarioId` (el mismo claim que deja `SupabaseAuthService#mirrorUsuario`).
  Revalida además que el `rol` embebido en el token siga coincidiendo con el de la fila actual
  — si no, rechaza (más seguro que confiar en un claim potencialmente desactualizado).
  Deliberadamente NO revalida `activo`/`SUSPENDIDA`/`mustChangePassword` — eso es el paso 4,
  a propósito, para que este servicio haga una sola cosa.
- **Nada lo usa todavía** — no está conectado a `JwtAuthGuard` ni a ninguna ruta real. Es
  infraestructura inerte, cero riesgo para el login actual.

**Verificado con un script standalone contra el proyecto de prueba real** (obtuve un access
token real vía `POST /auth/v1/token?grant_type=password` con las credenciales ya espejadas de
`jperez`): token válido → resuelve correctamente al usuario correcto; firma alterada →
rechazado; payload alterado (intento de hacerse pasar por otro usuario cambiando
`usuarioId`) → rechazado (invalida la firma); basura/no-JWT → rechazado. Gate completo
(lint:ci, build, test, migrate status) verde. No se agregó un spec de Jest para este servicio
todavía — testearlo en aislamiento requeriría poder inyectar un JWKS falso en vez del remoto
real, y prefiero decidir esa forma final una vez que el paso 4 defina cómo se integra de
verdad, en vez de comprometerme a una interfaz ahora para después tener que cambiarla.

**Pendiente:** paso 4 (guard propio con las 3 validaciones por-request) es el siguiente,
a la espera de autorización.

## [2026-08-14 01:43] Fase 7, paso 4: guard propio con las 3 validaciones por-request (todavía inerte, sin cortar el login)

**Cambios:**
- `src/common/constants/must-change-password-allowlist.ts` (nuevo): `MUST_CHANGE_PASSWORD_ALLOWLIST`
  se extrajo de `jwt.strategy.ts` a este archivo compartido, para que tanto la estrategia JWT
  actual como el guard nuevo usen exactamente la misma lista en vez de arriesgarse a que
  diverjan con el tiempo.
- `src/common/guards/supabase-jwt-auth.guard.ts` (nuevo): `SupabaseJwtAuthGuard` reimplementa,
  sobre un token de Supabase Auth (verificado con `SupabaseJwtVerifierService` del paso 3) en
  vez del JWT propio, las mismas 3 revalidaciones por-request que hace hoy
  `JwtStrategy.validate()`: `activo`, `iglesia.estado === SUSPENDIDA` (con el mismo
  `IglesiaSuspendidaException`/`diasEnMora`), y el allowlist de `mustChangePassword`. Extrae el
  token de `Authorization: Bearer`, no de una cookie — el esquema de cookies/CSRF definitivo
  para Supabase Auth es el paso 7, todavía sin decidir, y usar Bearer acá evita presumir esa
  respuesta.
- `modulos` queda `[]` a propósito en el payload que arma el guard: de dónde salen los módulos
  delegados (`AccesoModulo`) con Supabase Auth es la decisión del paso 5, todavía sin tomar.
- **Sigue sin estar conectado a ninguna ruta real** — ningún controller usa `SupabaseJwtAuthGuard`
  todavía. `JwtAuthGuard`/`JwtStrategy` (JWT propio) siguen siendo la única puerta de entrada
  real; el login actual no cambia en absoluto con este paso.

**Funcionalidad:** deja lista la pieza que le faltaba al paso 3 para que verificar un token de
Supabase Auth sea equivalente en seguridad al sistema actual — sin este guard, un token de
Supabase válido pero de un usuario desactivado, de una iglesia suspendida, o que todavía debe
cambiar su contraseña temporal, habría pasado igual. Con paso 3 + paso 4 juntos, ya existe (en
paralelo, sin activar) toda la infraestructura necesaria para autenticar una request con
Supabase Auth con las mismas garantías que hoy.

**Gate verificado:** `lint:ci` limpio, `build` (`nest build`) sin errores, `test` (18/18,
4 suites) verde, `prisma migrate status` con el schema al día (13 migraciones, sin drift). No
se agregó spec de Jest para el guard todavía — sigue sin estar conectado a ninguna ruta, y
mismo razonamiento que en el paso 3: prefiero fijar la forma final de los tests una vez que el
paso 5 (módulos delegados) decida qué va en el payload, en vez de comprometerme a una interfaz
de test ahora para después tener que rehacerla.

**Pendiente:** paso 5 (de dónde salen los módulos delegados — `AccesoModulo` — con Supabase
Auth: Custom Access Token Hook vs. seguir consultando `getModulosOtorgados` en cada request) es
el siguiente, a la espera de autorización.

## [2026-08-14 02:05] Fase 7, paso 5: módulos delegados (`AccesoModulo`) resueltos en el guard, sin Custom Access Token Hook

**Decisión:** entre las dos opciones que planteaba `docs/supabase.md` (Custom Access Token
Hook del lado de Supabase vs. seguir consultando `getModulosOtorgados` por request), se
descartó el Hook — exigiría desplegar y mantener una función Postgres nueva en el proyecto de
prueba de Supabase, y el resultado sería estrictamente peor: un Hook solo refresca el claim
`modulos` al emitir/refrescar el token (misma "ventana acotada" de hasta 15 min que ya existe
hoy, documentada en `JwtStrategy`), mientras que resolverlo en el guard da el módulo al día en
cada request — y sin costo extra, porque el guard ya paga una query por request para
`activo`/`iglesia`.

**Cambios:**
- `src/common/guards/supabase-jwt-auth.guard.ts`: la misma query que ya hacía el guard para
  `activo`/`iglesia`/`mustChangePassword` ahora también trae `accesosPropios` (relación
  `AccesoModulo` del usuario) — ninguna query adicional. `modulos` del payload queda igual que
  `AuthService#getModulosOtorgados`: solo tiene contenido para `Rol.USUARIO`, `[]` para el
  resto de los roles (MANAGER tiene acceso total por rol, no por lista delegada; SUPER_ADMIN/
  MIEMBRO no usan estos módulos).
- **Sigue sin estar conectado a ninguna ruta real** — mismo estado inerte que los pasos 3-4.

**Funcionalidad:** con esto, la infraestructura en paralelo para Supabase Auth (pasos 3-5)
queda funcionalmente completa en cuanto a "qué puede hacer esta persona" — replica las 3
revalidaciones de `JwtStrategy` más el claim de módulos delegados, con una garantía de
frescura igual o mejor que el sistema actual, sin agregar infraestructura nueva del lado de
Supabase.

**Gate verificado:** `lint:ci` limpio, `build` sin errores, `test` (18/18, 4 suites) verde vía
`npx jest --runInBand` (el run normal con workers paralelos falló por OOM — no es una
regresión de este cambio, sino memoria agotada por la cantidad de procesos `node` ya corriendo
en la máquina; con `--runInBand` corre limpio), `prisma migrate status` sin drift (13
migraciones, sin cambio de schema en este paso). Sigue sin spec de Jest dedicado — mismo
razonamiento que pasos 3-4: se fija la interfaz de test recién cuando el guard se conecte a
una ruta real.

**Pendiente:** paso 6 (garantía de rotación + detección de reuso de refresh tokens equivalente
a `AuthService#refreshTokens`) es el siguiente, a la espera de autorización.

## [2026-08-14 02:25] Fase 7, paso 6: confirmado — Supabase Auth da una garantía equivalente (y en un aspecto, más segura) que `AuthService#refreshTokens`, con un cambio de comportamiento consciente

Paso puramente de investigación/decisión — sin código, porque la garantía la da el servidor
de Supabase Auth, no algo que este backend deba construir. Verificado contra la documentación
oficial (`supabase.com/docs/guides/auth/sessions`, vía `mcp__supabase__search_docs`, no de
memoria) en vez de asumirlo.

**Lo que hace hoy `AuthService#refreshTokens` (línea base a igualar):**
- Rotación: cada refresh consume el token (fila `revoked: true` vía `updateMany` atómico y
  condicional) y emite uno nuevo — un token usado dos veces en dos requests simultáneas solo
  deja ganar a una (race-safe).
- Detección de reuso: si se presenta un token que YA estaba `revoked`, se interpreta como robo
  y se revocan **todas** las refresh tokens activas del usuario — todos sus dispositivos
  quedan deslogueados, no solo el que reusó el token.

**Lo que confirma la documentación de Supabase Auth:**
- Rotación de un solo uso es el comportamiento *por defecto*, no opt-in: "a refresh token can
  only be used once... You can exchange a refresh token only once to get a new access and
  refresh token pair."
- Detección de reuso también es nativa y default-on (desactivable en Advanced Settings, pero
  "generally not recommended" — ni siquiera lo consideré). Dos excepciones deliberadas antes de
  declarar robo: (a) ventana de gracia de 10s para reuso legítimo (SSR, retries), y (b) si se
  reintenta el *padre* del token actualmente activo (típico de una respuesta de red perdida
  después de una rotación exitosa), devuelve el token activo en vez de terminar la sesión — esto
  es estrictamente más robusto que nuestro código actual: hoy, si un cliente rota exitosamente
  pero pierde la respuesta HTTP y reintenta con el token viejo, nuestro `refreshTokens` lo trata
  como reuso real y desloguea TODOS los dispositivos del usuario — un falso positivo que
  Supabase evita explícitamente.
- Detección de reuso está **scoped a la sesión** (una sesión = un sign-in = un dispositivo,
  `auth.sessions`, con su propio `session_id` en el JWT), no a la cuenta completa: "the whole
  session is regarded as terminated and all refresh tokens belonging to it are marked as
  revoked". Por defecto un usuario puede tener sesiones ilimitadas en dispositivos distintos, y
  detectar robo en una de ellas **no** termina las demás.

**Decisión — aceptar el comportamiento nativo de Supabase, con este cambio consciente
documentado:** hoy, robo detectado en un dispositivo desloguea todos los dispositivos del
usuario (a propósito — "ante la duda, se cierra la sesión en todos los dispositivos"); con
Supabase Auth, robo detectado en un dispositivo solo termina esa sesión puntual, dejando las
demás intactas. Es un cambio de postura de seguridad (blast radius menor por defecto) que
considero aceptable — y en el caso de falso positivo por red, superior a lo que hay hoy — pero
es una decisión de producto, no solo técnica, así que queda anotada acá explícitamente en vez
de asumida en silencio. Si más adelante se quisiera replicar el "todos los dispositivos fuera"
de hoy, existe `supabase.auth.admin.signOut(userId, scope: 'global')` del lado admin para
igualarlo — no se implementa todavía porque nada llama login/logout real contra Supabase Auth
aún (sigue en modo espejo).

No hay features Pro-only involucradas en esta garantía base (time-boxed sessions, inactivity
timeout, single-session-per-user sí son Pro-only, pero son controles opcionales aparte — no
hacen falta para igualar la garantía de rotación + reuso que ya tenemos).

**Pendiente:** paso 7 (esquema de cookies/CSRF para Supabase Auth: httpOnly + double-submit
propio de hoy vs. patrón recomendado por `@supabase/ssr`) es el siguiente, a la espera de
autorización.

## [2026-08-14 02:50] Fase 7, paso 7: decidido — NO se adopta `@supabase/ssr`, se mantiene el esquema de cookies httpOnly + CSRF double-submit propio

Paso de investigación/decisión — sin código (nada cambia en `cookies.ts`/`csrf.middleware.ts`
hoy; la decisión aplica cuando se implemente el cutover real, todavía sin autorizar). Verificado
contra la documentación oficial (`supabase.com/docs/guides/auth/server-side/*`, vía
`mcp__supabase__search_docs`).

**Lo que confirma la documentación de `@supabase/ssr`:**
- Las cookies del patrón recomendado **no son `httpOnly`, a propósito**: la propia documentación
  de Supabase responde "¿cómo hago las cookies HttpOnly?" con "no es necesario — tanto el access
  token como el refresh token están pensados para viajar a distintos componentes de tu app, y el
  lado browser de tu app necesita acceso al refresh token de todas formas". Es decir, el modelo
  de Supabase acepta a propósito que el refresh token sea legible por JS.
- El patrón asume que **el frontend (Next.js) habla directo con el servidor de Auth de
  Supabase** — `createBrowserClient`/`createServerClient` de `@supabase/ssr`, más un
  middleware/proxy de Next.js que llama `supabase.auth.getClaims()` en cada request. Nuestro
  propio backend NO participa en ese flujo: no es "cambiar cómo se guardan las cookies", es un
  cambio de quién es dueño de la sesión.
- La documentación de `@supabase/ssr` no menciona CSRF en ningún lado (confirmado: cero
  ocurrencias en las páginas relevantes) — consistente con que en ese modelo el navegador
  termina hablando con el servidor de Supabase (potencialmente cross-origin vía Bearer/su propio
  esquema), no con endpoints mutantes propios protegidos por cookie.

**Por qué no se adopta:**
1. **Nuestro `httpOnly` + CSRF double-submit fue una decisión de seguridad deliberada**
   (`docs/auth-cookies.md`: "cerrar el riesgo de robo de tokens vía XSS", justificado
   explícitamente por manejar datos financieros/personales de iglesias a nivel nacional).
   Supabase acepta el trade-off contrario (refresh token legible por JS) como parte de su
   diseño — adoptarlo en silencio bajaría nuestra postura de seguridad sin que sea una decisión
   consciente.
2. **Es un cambio de arquitectura, no de formato de cookie.** Adoptar `@supabase/ssr` de verdad
   implicaría que el frontend (Next.js) pase a hablar directo con Supabase Auth vía su SDK —
   exactamente lo que el paso 9 del plan describe como "cambio mucho más grande". Mezclarlo con
   la decisión de cookies/CSRF (paso 7) los acopla innecesariamente.
3. **La necesidad de CSRF no depende de quién emite el token.** Nuestros propios endpoints
   mutantes (`finanzas`, etc.) van a seguir autenticándose por cookie contra NUESTRA API — el
   vector de CSRF (un sitio malicioso hace que el navegador mande la cookie de sesión sin que el
   usuario se entere) sigue existiendo sin importar si el JWT adentro lo firmó nuestro backend o
   lo emitió Supabase Auth.

**Decisión:** cuando llegue el cutover real, el contrato completo de `docs/auth-cookies.md`
queda igual — mismas 3 cookies (`access_token` httpOnly, `refresh_token` httpOnly con
`Path=/auth/refresh`, `csrf_token` legible), mismo `CsrfMiddleware`, mismos endpoints
(`POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`) en nuestra propia API. Lo único
que cambia por dentro es qué emite/valida el token: nuestro backend sigue siendo el único que le
habla a Supabase Auth (server-to-server, vía el mismo API REST de GoTrue que ya probé en el
paso 3 — `grant_type=password`/`grant_type=refresh_token`), y sigue siendo el que arma las
cookies con `setAuthCookies` (`cookies.ts`, sin cambios) — el navegador nunca ve un token de
Supabase directamente ni corre `supabase-js`. Consecuencia directa: **el paso 9 del plan
("actualizar el frontend para usar `supabase-js`") queda descartado** — no hace falta, porque el
frontend nunca deja de hablarle a nuestra propia API. `docs/supabase.md` y `prompt.md`
actualizados para reflejar esto.

**Pendiente (nota para cuando se implemente el cutover, no ahora):** el flujo `grant_type=password`
de GoTrue típicamente se autentica con la `anon`/`publishable` key del proyecto (no la
`service_role` que ya usamos para `mirrorUsuario`/admin) — vamos a necesitar agregar esa key al
`.env` cuando se implemente el login real contra Supabase, no antes.

**Pendiente:** paso 8 (migrar el flujo de invitación de Tesorero/Secretaria al mecanismo de
invitación de Supabase Auth) es el siguiente, a la espera de autorización.

## [2026-08-14 03:10] Fase 7, paso 8: cerrado sin código — el espejo existente ya cubre a Tesorero/Secretaria; el invite-by-email de Supabase queda fuera de la Fase 7 como decisión de producto aparte

A diferencia de los pasos 3-7 (100% internos, sin tocar UX del frontend), este paso sí
implicaba una decisión de producto real, así que se la planteé al fundador en vez de decidirla
sola — igual que las decisiones técnicas de los pasos 5-7, pero esta cambiaba una experiencia
que ve una persona real (cómo un Tesorero/Secretaria recibe su cuenta), no solo plomería
interna.

**Hallazgo — el paso, tal como estaba redactado en `docs/supabase.md`, ya estaba resuelto:**
- Hoy `UsuariosService#create` (cuando el Pastor da de alta a un Tesorero/Secretaria) no manda
  ningún correo — genera una contraseña temporal y la devuelve en la respuesta de la API para
  que el Pastor la comparta manualmente. Confirmé que ningún flujo de `usuarios` usa
  `MailService` (sí lo usan predicadores/facturación, pero no este).
- `SupabaseAuthService#mirrorUsuario` (paso 1-2) se dispara en **cualquier** login exitoso, sin
  filtrar por rol ni por cómo se creó la fila `Usuario` — así que un Tesorero/Secretaria recién
  creado queda espejado en Supabase Auth automáticamente en su primer login, con la misma
  contraseña temporal de siempre. El objetivo técnico del paso 8 (que Supabase Auth tenga una
  copia de todos los usuarios reales, no solo de los managers) ya estaba cubierto sin escribir
  una línea nueva.

**Lo que sí sería nuevo (y se dejó fuera a propósito):** adoptar de verdad
`supabase.auth.admin.inviteUserByEmail()` — Supabase le manda un correo directo a la persona
invitada con un link para que defina su propia contraseña, sacando al Pastor de la cadena por
completo. Investigado contra la documentación oficial: requeriría (a) una página nueva en el
frontend para completar la invitación (contradice el "sin cambios para el frontend" que
acabábamos de asentar en el paso 7 — aunque sin `supabase-js`, ya que el intercambio del token
de invitación se puede hacer server-to-server igual que login/refresh), y (b) para que el
correo tenga nuestra marca en vez de la plantilla genérica de Supabase, desplegar un Auth Hook
(función Edge) que enrute el envío por Resend — infraestructura nueva del lado de Supabase, la
misma categoría que se descartó a propósito en el paso 5 (Custom Access Token Hook).

**Decisión (confirmada con el fundador):** mantener la UX actual sin cambios — el paso 8 queda
cerrado tal como estaba planteado en el plan original. Adoptar el invite-by-email de Supabase
se deja anotado como una mejora de producto **separada y opcional**, a evaluar en su propio
momento, no como parte de la Fase 7 ni bloqueando el resto de sus pasos.

**Pendiente:** con esto, los 9 pasos originales de la Fase 7 quedan resueltos (3 con
infraestructura nueva: pasos 3-5; 3 solo con decisión/documentación: pasos 6-8; paso 9
descartado como consecuencia del 7). Lo único que falta para un cutover real es la
implementación final (reemplazar de verdad `LocalStrategy`/`JwtStrategy` por el flujo de
Supabase en `POST /auth/login`/`POST /auth/refresh`) — todavía sin autorizar, y sigue
condicionado a probarlo de punta a punta contra el proyecto de prueba antes de tocar el login
real (ver recomendación al inicio de la sección de Fase 7 en `docs/supabase.md`).

## [2026-08-15 00:00] Nuevo documento: guion de venta (`evangelicapp.md`)

**Cambios:** `evangelicapp.md` (nuevo, raíz del repo) — guion conversacional de un vendedor de
EvangelicApp presentando la plataforma al equipo pastoral de una iglesia. Cubre los 5 módulos
(Agenda, Finanzas como módulo estrella, Notas/Tareas, Integrantes, Ceremonias), seguridad
(aislamiento multi-tenant, permisos delegables por módulo, bcrypt, refresh tokens revocables,
CSRF, tokens públicos de un solo propósito) y personalización (logo, categorías/departamentos
financieros propios, colores de eventos, planes Básico/Medio/Pro con sus topes reales de
`common/constants/plan.ts`). Contenido verificado contra el schema de Prisma y las constantes de
planes antes de escribir — no se inventó ninguna funcionalidad (ej. no se menciona pasarela de
pago automática, porque hoy la confirmación de pago es manual, ver entrada del 2026-08-03).

**Funcionalidad:** documento de referencia/marketing para conversaciones de venta con iglesias —
no es documentación técnica ni de negocio como `README.md`/`CLAUDE.md`, es material de discurso
comercial. Surgió de una conversación exploratoria sobre pivotar el producto a CRM genérico para
pymes (sin cambios de código, solo análisis) en la que se concluyó que el ángulo más fuerte hoy
sigue siendo el dominio actual (iglesias) por la fuerza real del módulo de Finanzas auditado.

## [2026-08-15 15:30] WhatsApp Business Cloud API — primer canal, convocatoria a integrantes (junto al email, no en su reemplazo)

Pedido del usuario tras analizar `informe.md` (mercado brasileño de SaaS eclesiástico): WhatsApp
es el canal dominante en LatAm, muy por encima del email. El fundador ya había decidido de
antemano (`docs/colaboradores-qr.md`, 2026-07-08) usar la **API oficial de WhatsApp Business
(Meta Cloud API)**, nunca librerías no oficiales, por riesgo real de baneo del número. Alcance
acotado explícitamente por el usuario a un solo flujo — convocatoria a integrantes — y con la
instrucción explícita de **no eliminar el email hasta que WhatsApp esté listo**: ambos canales
quedan activos en paralelo de forma permanente, no es un cutover.

**Cambios — módulo nuevo `backend/src/modules/whatsapp/` (espeja el patrón de `mail/`):**
- `providers/whatsapp-provider.interface.ts`: interfaz `WhatsAppProvider` con
  `sendTemplateMessage(params)` — a diferencia de `EmailProvider.sendMail` (HTML libre), recibe
  una plantilla estructurada (`templateName`, `languageCode`, `variables[]`), porque Meta exige
  que todo mensaje iniciado por el negocio use una plantilla pre-aprobada, nunca texto libre.
  Token de inyección `WHATSAPP_PROVIDER`.
- `providers/meta-cloud-api-whatsapp.provider.ts`: implementación real — `POST` a
  `https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages` vía
  `fetch` nativo de Node (sin dependencia nueva — el proyecto no tenía `axios`/`@nestjs/axios`,
  y esta es la primera integración por HTTP crudo a un tercero del backend).
- `providers/noop-whatsapp.provider.ts`: mismo criterio que `SupabaseAuthService` en modo no-op
  (Fase 7 de `docs/supabase.md`) — sin `WHATSAPP_ACCESS_TOKEN`, loguea un warning una sola vez y
  no hace nada. Nadie necesita credenciales de Meta para correr el backend local.
- `whatsapp.service.ts`: `WhatsAppService.enviarConvocatoriaEvento(...)` — mismo shape de
  parámetros que `MailService.enviarConvocatoriaEvento`, arma variables de plantilla en vez de
  HTML. Try/catch propio (nunca lanza al llamador), mismo criterio best-effort que `MailService`.
- `whatsapp.module.ts`: `useFactory` igual que `MailModule` — construye
  `MetaCloudApiWhatsAppProvider` solo si `WHATSAPP_ACCESS_TOKEN` está seteado, si no
  `NoopWhatsAppProvider`.
- `common/utils/normalize-phone-e164.util.ts` (nuevo): `normalizarTelefonoE164(...)` — Meta exige
  formato E.164 (`+56912345678`) y `Integrante.telefono` es texto libre a nivel de columna, sin
  formato forzado. Limpia espacios/guiones, asume `+56` para un número chileno de 9 dígitos, deja
  pasar si ya viene en E.164, devuelve `null` si no se puede normalizar — el llamador saltea solo
  ese envío puntual, sin afectar al resto del batch ni al email de esa misma persona.

**Cambios — wireado (único cambio a código de negocio existente):**
- `eventos.service.ts#notificarIntegrantes`: junto al `mailService.enviarConvocatoriaEvento(...)`
  que ya existía dentro del `Promise.allSettled` fire-and-forget, se agregó
  `whatsappService.enviarConvocatoriaEvento(...)` para el mismo integrante, en el mismo batch
  paralelo — la llamada a email no se tocó ni se removió. El select de `Integrante` ahora trae
  también `telefono`/`nombreCompleto`, y la firma del `evento` recibido por el método privado se
  amplió con `fechaInicio`/`ubicacion` (ya venían en el objeto real, solo faltaban en el tipo).
- `agenda.module.ts`: importa `WhatsAppModule`.
- `.env.example`: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`
  (default `v21.0`), `WHATSAPP_TEMPLATE_CONVOCATORIA_EVENTO` (default `convocatoria_evento`),
  todas opcionales — con las mismas vacías, el comportamiento no cambia respecto a hoy.

**Verificado:** `tsc --noEmit`, `eslint` y `nest build` limpios. Arranque real del backend
compilado (`node dist/main.js`) contra el `.env` local (sin `WHATSAPP_ACCESS_TOKEN` seteado):
`WhatsAppModule dependencies initialized` sin errores de inyección de dependencias, seguido del
resto del árbol de módulos y el mapeo completo de rutas — confirma que el modo no-op no rompe el
arranque. El proceso terminó después por `PrismaClientInitializationError: Can't reach database
server at localhost:5432` (Docker Desktop no estaba corriendo en esta sesión) — no relacionado a
este cambio, mismo bloqueador que ya aparece en entradas anteriores de esta bitácora.

**Pendiente — depende del usuario, no de más código:**
- Envío real de punta a punta (con `Integrante` real, Postgres local levantado y las
  credenciales de prueba de Meta que el usuario ya tiene en su `.env`) queda para cuando levante
  su Postgres local — no se le pidieron las credenciales por chat, se agregan directo a su `.env`.
- El usuario ya tiene una app de developers.facebook.com con access token y número de prueba
  (mandó un WhatsApp de prueba a sí mismo), pero **falta crear y aprobar la plantilla
  `convocatoria_evento`** en WhatsApp Manager (categoría Utility) antes de que un envío real
  funcione — sin plantilla aprobada, la Graph API rechaza el mensaje aunque el token sea válido.
- Para llegar a integrantes reales de una iglesia (no solo al propio número de prueba del
  usuario) hace falta además un número de WhatsApp Business real + verificación de negocio de
  Meta — tiene demora externa de días a semanas, conviene iniciarlo en paralelo.
- Fuera de alcance de esta entrada (decidido explícitamente con el usuario): facturación
  (`Usuario.telefono` del Manager es opcional, necesitaría fallback a solo-email) y predicadores
  (`Predicador` no tiene campo de teléfono, requeriría migración de schema).

## [2026-08-15 16:10] Nuevo documento: `docs/supabase-todo.md` — checklist de estado del plan de Supabase

**Cambios:** `docs/supabase-todo.md` (nuevo) — checklist de seguimiento rápido de las 8 fases de
`docs/supabase.md`: qué está hecho (Fases 1, 2, 3, 4, 5, y la base de la 7), qué está bloqueado
(Fase 6, por modelo de negocio sin definir) y qué falta (el cutover final de la Fase 7 — sin
autorizar todavía — y la Fase 8/RLS, que depende 100% de que la 7 esté cortada de verdad). Se
detectó de paso que `docs/supabase.md` nunca marcó la Fase 4 (cron de recordatorios) como resuelta
con una línea de "Actualización" — sí lo está (ver entrada del 2026-08-10), solo quedó sin anotar
en el documento original; queda registrado en el nuevo TODO para no perder el dato.

**Funcionalidad:** el usuario pidió un archivo de seguimiento del avance de Supabase mientras
esperaba la aprobación de la plantilla de WhatsApp en Meta. `docs/supabase.md` es el plan
detallado (paso a paso técnico de cada fase) pero es largo — este archivo nuevo es el
complemento de lectura rápida (estado + qué sigue), sin duplicar el detalle técnico que ya vive
en el documento original.

## [2026-08-15 20:35] Fase 7 de docs/supabase.md: cutover final — login y refresh reales contra Supabase Auth

Pedido del usuario: cortar de verdad la Fase 7. Hasta esta entrada, toda la infraestructura de
Supabase Auth (espejo, verificación JWKS, guard con las 3 revalidaciones) existía en paralelo
pero inerte — el login real seguía siendo 100% JWT/bcrypt propio. Antes de escribir código se
investigó a fondo el sistema actual y la infraestructura ya construida (dos exploraciones en
paralelo) para diseñar el corte, documentado en un plan aprobado explícitamente por el usuario
(alcance: corte directo, sin feature flag de legacy/supabase — mantener ambos sistemas
coexistiendo permanentemente era la complejidad que el proyecto pide evitar).

**Hallazgo crítico de la investigación (no estaba anticipado en `docs/supabase.md`):** los
refresh tokens de GoTrue son strings opacos, no JWT — a diferencia del access token. No hay nada
que verificar localmente; la única forma de validar uno es presentárselo de verdad a GoTrue.
`JwtRefreshStrategy`/`JwtRefreshGuard` (que verificaban el refresh token como un JWT firmado con
`JWT_REFRESH_SECRET`) no podían adaptarse, se retiraron.

**Hallazgo crítico #2:** `SupabaseAuthService#mirrorUsuario` solo creaba el espejo la primera
vez — cualquier usuario que hubiera cambiado su contraseña después de ser espejado (`jperez` de
seed, por ejemplo, con `mustChangePassword: true` de fábrica) tendría el espejo con la
contraseña temporal vieja, y el cutover le habría roto el login. Resuelto con un fallback
auto-sanador (ver diseño abajo) — verificado en vivo en la sección de pruebas.

**Hallazgo crítico #3, encontrado durante la implementación (fuera del alcance original del
plan):** `RealtimeGateway` (Fase 5, WebSockets) verificaba el `access_token` de forma
independiente con `JwtService`/`JWT_ACCESS_SECRET` propio — se habría roto en cuanto el access
token pasara a ser un JWT ES256 emitido por Supabase. Se corrigió en la misma pasada (ver
cambios abajo), no quedó para después.

**Cambios — `src/supabase/supabase-auth.service.ts`:**
- Métodos nuevos: `signInWithPassword` (`grant_type=password` contra GoTrue vía `fetch` nativo,
  mismo patrón que `MetaCloudApiWhatsAppProvider` — sin dependencia HTTP nueva; `null` en
  credenciales inválidas, distinto de un error real de config/red, que se lanza), `refreshSession`
  (`grant_type=refresh_token`), `syncPassword` (`admin.updateUserById`, corrige un espejo
  desincronizado), `signOut` (`admin.signOut(accessToken, scope)`, best-effort — nunca lanza,
  para que un hipo de Supabase no vuelva un logout en un 500).
- Nueva env var `SUPABASE_AUTH_TEST_ANON_KEY` (legacy, formato JWT) — obtenida vía MCP
  (`get_publishable_keys` contra el proyecto de prueba), no pegada a mano.

**Cambios — `src/modules/auth/auth.service.ts`:**
- `validateUser`: intenta `signInWithPassword` primero; si Supabase rechaza pero bcrypt local
  confirma la contraseña, sincroniza (mirror si `supabaseUserId` es null, si no `syncPassword`)
  y reintenta una sola vez — nunca emite sesión basada solo en bcrypt, porque los tokens reales
  solo los emite Supabase. Devuelve `{ usuario, session }` (nuevo tipo `ValidatedLogin`).
- `login`: arma la respuesta con los tokens de la `session` de Supabase, ya no con
  `issueTokens` (eliminado, igual que `hashToken`).
- `refreshTokens`: rota contra GoTrue en vez de la tabla `RefreshToken` local (rotación/detección
  de reuso ahora las hace Supabase — decisión ya aceptada el 2026-08-14).
- `logout`/`changePassword`: llaman a `supabaseAuth.signOut(accessToken, 'global')` en vez de
  revocar `RefreshToken` locales — mismo efecto (cierra sesión en todos los dispositivos).
  `changePassword` además sincroniza la nueva contraseña hacia Supabase (best-effort: si falla,
  el próximo login se autosana igual).
- Constructor: se quitan `JwtService`/`ConfigService` (ya no se firma JWT propio), se agrega
  `SupabaseJwtVerifierService`.

**Cambios — capa HTTP:**
- `local.strategy.ts`: `validate` devuelve `ValidatedLogin` (`{ usuario, session }`), no solo
  `Usuario`.
- `auth.controller.ts`: `login` lee `{ usuario, session }` de `req.user`. `refresh` deja de usar
  `JwtRefreshGuard` (no puede verificar un token opaco) — lee `req.cookies.refresh_token`
  directo. `logout`/`change-password` ahora pasan el `access_token` de la cookie al service.
- `common/guards/jwt-auth.guard.ts`: reescrito de `extends AuthGuard('jwt')` a
  `implements CanActivate` — verifica vía JWKS (`SupabaseJwtVerifierService`), mismas 3
  revalidaciones de siempre (`activo`, `iglesia SUSPENDIDA`, allowlist de
  `mustChangePassword`), extrae el token de la cookie `access_token` con fallback a
  `Authorization: Bearer`. Absorbe la lógica de `supabase-jwt-auth.guard.ts` (retirado) — ya no
  tiene sentido mantener dos guards casi idénticos.
- `auth.module.ts`: ya no registra `JwtStrategy`/`JwtRefreshStrategy`/`JwtModule`.

**Cambios — `RealtimeGateway`/`RealtimeModule` (hallazgo #3):** el gateway ahora verifica el
token con `SupabaseJwtVerifierService` (mismo servicio que `JwtAuthGuard`) y vuelve a consultar
`rol`/`iglesiaId` frescos de la BD en vez de confiar en los claims del payload — mismo criterio
que el guard HTTP. `RealtimeModule` ya no importa `JwtModule.register({})` (dejó de hacer falta).

**Retirado:** `jwt.strategy.ts`, `jwt-refresh.strategy.ts`, `jwt-refresh.guard.ts`,
`supabase-jwt-auth.guard.ts`. El modelo `RefreshToken` **no se borró** del schema — se dejó de
escribir/leer, pero tirar la tabla queda como migración separada, después de confirmar que el
corte funciona sin sobresaltos. Comentarios sueltos que referenciaban `JwtStrategy` (`main.ts`,
`iglesia-suspendida.exception.ts`, `iglesias.service.ts`, `must-change-password-allowlist.ts`)
actualizados para no quedar engañosos.

**Verificado de punta a punta contra el servidor local (Postgres) y el proyecto real de prueba
(`Backend-auth-test`), con curl real, no solo build:**
- `tsc --noEmit`, `eslint`, `nest build` limpios.
- Login de `jperez` (`pastor@demo.cl`) → `access_token` confirmado como JWT ES256 emitido por
  `grcywqjcqwpbuekqbupj.supabase.co` (no HS256 propio), `refresh_token` confirmado como string
  opaco corto (no JWT). `GET /auth/me` funciona con el token verificado por JWKS.
  `GET /agenda/eventos` bloqueado 403 mientras `mustChangePassword: true`.
- `POST /auth/refresh` rota las 3 cookies correctamente. Un refresh token basura/inválido
  devuelve 401 limpio. **Nota de comportamiento distinta a la documentada originalmente:**
  reintentar un refresh token recién rotado, dentro de una ventana corta (~10s), NO lo rechaza
  como reuso — GoTrue tiene un período de gracia de reuso pensado para reintentos de red del
  cliente, y devuelve la sesión vigente en vez de revocar todo. Es un comportamiento real de
  GoTrue, no un bug de esta implementación — actualiza lo que `docs/supabase.md` paso 6 asumía
  sobre "detección de reuso" (existe, pero no es instantánea como la versión local que reemplaza).
- `PATCH /auth/change-password` con `jperez`: login con la contraseña vieja rechazado después
  del cambio, login con la nueva funcionando directo (sin pasar por el fallback) — confirma que
  `syncPassword` corrigió el espejo de verdad.
- `POST /auth/logout` seguido de un intento de refresh con la misma cookie → 401. Confirma que
  `signOut('global')` revoca la sesión en Supabase de verdad, no solo limpia cookies locales.
- Login de `admin@evangelicapp.cl` (SUPER_ADMIN, `iglesiaId: null`) → sin crash en el chequeo de
  `iglesia?.estado`, funciona igual que cualquier otro rol.
- **Verificación orgánica del fallback auto-sanador:** se restauró la cuenta demo corriendo
  `npm run prisma:seed` (mismo criterio que sesiones anteriores) — el seed resetea el hash local
  a `Temporal123` pero no toca `supabaseUserId`, así que el espejo de Supabase quedó con la
  contraseña que se había puesto en la prueba de `change-password`, desincronizado a propósito.
  El siguiente login con `Temporal123` pasó por el fallback (bcrypt local acierta, Supabase
  rechaza, se sincroniza, se reintenta) y funcionó — la primera vez que este mecanismo se probó
  con una desincronización real, no simulada.
- **No probado en esta pasada:** el camino de `IglesiaSuspendidaException` (lógica sin cambios,
  se evitó mutar el estado de facturación de la iglesia demo sin necesidad) y una conexión real
  de WebSocket contra `RealtimeGateway` (verificado por compilación + mismo patrón ya probado del
  guard HTTP, no por un socket real conectado).

**Pendiente:** con esto, el corte de la Fase 7 queda funcionalmente completo y probado en local.
La Fase 8 (RLS) sigue bloqueada aparte por su propio caveat técnico (Prisma no abre conexiones
"como el usuario autenticado" — ver `docs/supabase.md` paso 8.3), no depende de nada de esta
entrada. Actualizar `docs/supabase-todo.md` para reflejar este cierre.

## [2026-08-16 18:35] `DATABASE_URL` apunta a Supabase (se deja de usar Postgres de Docker) + fix: identidad de Supabase Auth desincronizada entre bases

**Cambios — `DATABASE_URL`:** `backend/.env` pasa de Postgres local (Docker) al proyecto real de
Supabase (`lkcgiqmgdefhxhckedga`), a pedido del usuario. Antes de cambiarlo se auditó el estado
de esa base contra las migraciones locales (vía MCP de Supabase, sin necesitar la contraseña de
la DB todavía):
- Encontrada y corregida una fila corrupta en `_prisma_migrations` (`manager_usuario_accesos_modulo`
  duplicada, una completada y otra con `finished_at: null` de un intento fallido el 2026-07-30) —
  borrada por SQL directo (el cambio de esquema real de esa migración ya estaba aplicado
  correctamente en la fila buena, confirmado contra el schema real antes de tocar nada).
- Encontrada una tabla huérfana `password_reset_tokens` con su migración
  (`20260804190424_add_password_reset_token`) aplicada en esa base pero sin modelo en
  `schema.prisma`, sin migración local correspondiente, y sin ninguna mención en `FEATURES.md` —
  el usuario no la reconoció; se eliminó (`DROP TABLE`) vía MCP para alinear la base real con el
  código actual.
- Con la base ya limpia y la contraseña real agregada al `.env` por el usuario, se corrieron
  `prisma migrate status` y `prisma migrate deploy` (no vía MCP para esta parte — se intentó
  primero replicar el checksum de Prisma a mano para insertar las filas de tracking por SQL, pero
  el checksum calculado no coincidió con el real al verificarlo contra una migración ya aplicada;
  usar el motor real de Prisma evita ese riesgo). Quedaron aplicadas las 3 migraciones que
  faltaban, incluida `add_supabase_user_id_to_usuario` — crítica para todo el corte de la Fase 7
  de la entrada anterior. `prisma migrate status` confirmó "Database schema is up to date!".

**Bug real encontrado y corregido — identidad de Supabase Auth cruzada entre bases:** al probar
el login contra la base real (con una cuenta real del usuario, no demo), `POST /auth/login`
devolvía 200 pero la siguiente request (`GET /auth/me`) fallaba con 401 "Sesión inválida" y el
frontend volvía a la pantalla de login. Causa raíz: el proyecto de prueba de Supabase Auth
(`Backend-auth-test`) se comparte entre distintos backings de Postgres (local, y ahora Supabase)
— una cuenta con el mismo email+contraseña ya existía ahí desde pruebas anteriores contra
Postgres local, con `app_metadata.usuarioId` apuntando a una fila que no existe en la base de
Supabase actual. `signInWithPassword` la autenticaba con éxito (contraseña correcta) sin pasar
por el mecanismo de auto-sincronización de `AuthService#validateUser` (que solo cubría "Supabase
rechaza pero bcrypt local acepta", no "Supabase acepta pero la identidad es de otra base").

**Cambios:**
- `supabase-auth.service.ts`: nuevo método `relinkUsuario(supabaseUserId, usuario)` —
  `admin.updateUserById(supabaseUserId, { app_metadata: {...} })`, repunta una cuenta de Supabase
  Auth ya existente hacia la fila real de `Usuario`.
- `auth.service.ts#validateUser`: después de obtener cualquier sesión válida (por el camino
  directo o por el fallback), compara `session.supabaseUserId` contra `usuario.supabaseUserId`;
  si no coinciden, relinkea y persiste localmente. **Segundo hallazgo dentro del mismo fix:** el
  primer intento de la corrección no alcanzaba — el `access_token` que ya se había obtenido antes
  del relink quedaba con el `app_metadata` viejo horneado adentro (los JWT de Supabase son
  estáticos, actualizar el usuario no reemite tokens ya entregados). Hubo que agregar una
  reautenticación (`trySupabaseSignIn` de nuevo) después de relinkear, para obtener un access
  token que sí reflejara el `app_metadata` corregido — confirmado con dos rondas de prueba real
  antes de que funcionara.

**Verificado con una cuenta real del usuario (`rojascofrem@gmail.com`, SUPER_ADMIN), no con datos
demo:** reproducido el bug exacto por curl (200 en login, 401 en `/auth/me` inmediatamente
después), aplicado el fix, confirmado que `GET /auth/me` responde 200 con los datos correctos
(`id`, `rol: SUPER_ADMIN`, `iglesiaId: null`) y que `usuarios.supabaseUserId` quedó relinkeado
correctamente en la base real.

**Pendiente:** confirmar con el usuario que el login funciona también desde el frontend (no solo
curl). El resto de las cuentas reales de esta base (`matias`, `reno`, `betsa`, `luis`, `israel`,
`soto`, `matiascofre`) también tienen `supabaseUserId: null` hoy — cualquiera que se loguee por
primera vez contra esta base pasará por el mismo mecanismo de reconciliación (esperado, no
requiere acción manual por cuenta).

## [2026-08-16 18:45] Fix: acciones de "confirma tu contraseña" fallaban con la contraseña correcta y expulsaban al usuario del sistema

El usuario reportó que al cambiar la fecha de facturación (SuperAdmin) y reingresar su
contraseña, el sistema lo expulsaba — y que escribir mal esa contraseña de confirmación también
lo botaba del sistema en vez de mostrar un error puntual. Reproducido con su cuenta real
(`rojascofrem@gmail.com`), con su autorización explícita para usar la contraseña solo en este
diagnóstico.

**Causa raíz #1 — `verifyPassword` seguía comparando contra el hash local, no contra Supabase:**
`AuthService#verifyPassword` (usado por `ConfirmPasswordDto` en `PATCH /iglesias/:id/facturacion`
y en el borrado de ceremonias/movimientos/departamentos) hacía `bcrypt.compare` directo contra
`Usuario.password`. El corte de la Fase 7 (entrada del 2026-08-14) ya había resuelto este mismo
problema para el login (`validateUser`), pero `verifyPassword` y `changePassword` quedaron sin
tocar — un usuario que inicia sesión bien (porque Supabase Auth ya tiene la contraseña vigente,
aunque el hash local esté desactualizado) podía fallar cualquier confirmación de contraseña con
"Contraseña incorrecta" pese a escribir la contraseña correcta. Confirmado en vivo: la misma
contraseña que acababa de funcionar para el login devolvía 401 en el `PATCH` de facturación.

**Causa raíz #2 — 401 en vez de 403 para una confirmación fallida:** `verifyPassword` lanzaba
`UnauthorizedException` (401), el mismo código que usa `JwtAuthGuard` cuando la sesión es
inválida. Si el frontend trata cualquier 401 como "sesión inválida, cerrar sesión" (patrón común
de interceptor global), escribir mal la contraseña de confirmación expulsaba al usuario del
sistema en vez de mostrarle un error en el propio formulario.

**Cambios — `backend/src/modules/auth/auth.service.ts`:**
- Nuevo método privado `confirmarPassword(usuario, password)`: intenta Supabase primero
  (`trySupabaseSignIn`, la misma fuente de verdad que usa el login), con fallback a bcrypt local
  + resincronización si Supabase rechaza pero el hash local acierta — mismo patrón que
  `validateUser`, reutilizado en vez de duplicado.
- `verifyPassword` y `changePassword` ahora usan `confirmarPassword` en vez de `bcrypt.compare`
  directo.
- `verifyPassword` lanza `ForbiddenException` (403) en vez de `UnauthorizedException` (401) —
  mismo criterio que ya usa `IglesiaSuspendidaException` para distinguir "autenticado pero
  bloqueado por esto puntual" de "sesión inválida".

**Verificado con la cuenta real del usuario, con su propia contraseña:**
- `PATCH /iglesias/:id/facturacion` con la contraseña correcta → 200, fecha actualizada
  (antes: 401 "Contraseña incorrecta" pese a ser correcta).
- Mismo endpoint con una contraseña deliberadamente mala → 403 (antes: 401).
- `GET /auth/me` inmediatamente después del intento fallido → sigue en 200, la sesión no se
  invalidó por el intento de confirmación fallido.

**Pendiente:** este fix es del lado del backend — si el frontend además tiene lógica que trata
403 igual que 401 (no solo 401), habría que revisarla ahí también; no se pudo confirmar porque el
repo de frontend vive aparte. El mismo patrón `confirmarPassword` beneficia automáticamente a
todos los `ConfirmPasswordDto` existentes (ceremonias, movimientos financieros, departamentos),
no solo a facturación — no debería hacer falta repetir este fix ahí.

## [2026-08-16 19:00] Sincronización de documentación técnica: `README.md` y `docs/auth-cookies.md` desactualizados tras el corte de la Fase 7

El usuario preguntó si una sesión nueva de Claude en este repo entendería todo lo avanzado —
revisando `README.md` y `docs/auth-cookies.md` (el "cómo técnico" que referencia `CLAUDE.md`) se
encontró que ambos seguían describiendo el sistema **anterior** al corte de la Fase 7: login por
username, JWT propio firmado por este backend, refresh token como JWT, rotación/detección de
reuso contra una tabla `RefreshToken` local, `JwtStrategy` (ya no existe, es `JwtAuthGuard`), y
`README.md` además decía "Storage de logos es local (`uploads/`)" — desactualizado desde la Fase 1
(2026-08-08), de antes de esta sesión. Ninguno de los dos quedaba objetivamente falso por un
cambio silencioso — quedaron así porque las entradas de `FEATURES.md` documentan cada cambio en
el momento, pero nadie había vuelto a pasar por los documentos de referencia a corregir las
afirmaciones que esos cambios dejaban obsoletas.

**Cambios — `README.md`:**
- Tabla de stack: fila de Auth actualizada (Supabase Auth/GoTrue, no JWT propio); agregada fila de
  WhatsApp.
- Sección "Auth" reescrita: login por email, `access_token` es un JWT real de Supabase,
  `refresh_token` es un string opaco (no JWT), `JwtAuthGuard` (no `JwtStrategy`), fallback
  auto-sanador de `AuthService#validateUser`, y la distinción 403/401 de `verifyPassword`.
- Tabla de módulos: agregadas filas `whatsapp`, `realtime`, `supabase` (antes no existían en la
  tabla pese a llevar días/semanas en el código).
- Sección "Base de datos": aclara que `DATABASE_URL` apunta al proyecto real de Supabase de forma
  permanente (no un fallback), que esa base tiene datos reales de uso del equipo (no solo demo), y
  que Docker quedó como opción para pruebas puntuales, no el flujo habitual.
- Tabla de variables de entorno: agregadas todas las que faltaban (`SUPABASE_URL`/
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_AUTH_TEST_*`, `WHATSAPP_*`, `MAIL_PROVIDER`/
  `RESEND_API_KEY`) — la tabla solo tenía las variables del sistema original de JWT propio.
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` se quitaron (ya no firman nada, Supabase emite los
  tokens).
- Sección "Migraciones de base de datos" reescrita: recomendaba `prisma migrate dev` directo,
  peligroso ahora que `DATABASE_URL` apunta a la base compartida en vez de a un Postgres local
  descartable — se corrige a `migrate dev --create-only` + revisión manual + `migrate deploy`,
  con la advertencia de correr `migrate status` primero (ver la entrada de esta misma bitácora del
  2026-08-16 sobre la fila de migración corrupta que se encontró así).
- "Pendientes conocidos": quitados los 2 ítems ya resueltos (Storage local, `JwtStrategy`);
  agregados el modelo `RefreshToken` sin usar (pendiente de migración para eliminarlo) y la Fase 8
  (RLS) ya desbloqueada.

**Cambios — `docs/auth-cookies.md`:**
- Tabla de cookies: corregido que `refresh_token` es un string opaco de Supabase, no un JWT.
- `POST /auth/logout`: corregido — revoca la sesión en Supabase (`admin.signOut`), no una tabla
  `RefreshToken` local.
- Nueva sección sobre `ConfirmPasswordDto` devolviendo 403, no 401.
- Sección "Rotación de refresh token y condición de carrera entre tabs" reescrita: describía en
  detalle un mecanismo (`updateMany` condicional, revocación total ante reuso) que ya no existe;
  reemplazada por el comportamiento real de GoTrue (período de gracia de reuso ~10s), verificado
  contra el servidor real en la entrada del 2026-08-15.

**Cambios — `docs/supabase-todo.md`:** la fila de la Fase 7 ampliada para cubrir el trabajo de hoy
(cambio de `DATABASE_URL` + los dos bugs de identidad/confirmación de contraseña encontrados y
resueltos contra la base real).

**Funcionalidad:** que una sesión nueva (de Claude o de cualquier persona del equipo) que lea
`README.md`/`docs/auth-cookies.md` se lleve una imagen correcta del sistema actual, no la de hace
varias fases. `FEATURES.md` sigue siendo la fuente de verdad cronológica completa, pero nadie
debería tener que leer 1000+ líneas de bitácora para saber cómo funciona el login hoy — para eso
están estos documentos de referencia, y ahora vuelven a decir la verdad.

## [2026-08-19 00:00] Commit y push del trabajo acumulado (Fase 7 cutover, WhatsApp, fixes de auth, sync de docs)

El usuario pidió commitear y pushear a `features`; había ~7 entradas de bitácora sin commitear
desde el 2026-08-15 (todas las anteriores a esta). De paso se revisó el `git status` completo:

- `.gitignore` tenía un cambio sin commitear que agregaba `.env.example` a los ignorados
  (reemplazaba una línea en blanco) — parece accidental de una sesión anterior, ya que
  `.env.example` es la plantilla que debe quedar versionada para el equipo. Se revirtió antes de
  commitear.
- Dos archivos sin trackear y sin mención en la bitácora se dejaron fuera del commit a pedido del
  usuario: `evangelicapp-arquitectura.pdf` (632 KB, binario) y `backend/test-conn.sql` (archivo
  suelto de prueba de conexión, solo contenía `SELECT 1;`). Siguen sin trackear en el working
  directory por si el usuario los necesita después.

**Cambios:** commit único con todo el trabajo ya documentado en las entradas anteriores de esta
bitácora (WhatsApp Business Cloud API, cutover final de Fase 7 de Supabase Auth, cambio de
`DATABASE_URL` a Supabase + fix de identidad desincronizada, fix de 401→403 en confirmación de
contraseña, sync de `README.md`/`docs/auth-cookies.md`, documento `evangelicapp.md`, checklist
`docs/supabase-todo.md`) + reversión del cambio accidental en `.gitignore`.

**Funcionalidad:** ninguna funcionalidad nueva — deja el historial de git al día con el estado
real del código, que ya llevaba varios días de trabajo sin commitear.

## [2026-08-20 19:15] Fase 8 de docs/supabase.md: RLS atada al contexto de tenant (última fase del plan de Supabase)

Implementación completa de Row Level Security en Postgres como segunda capa de defensa del
aislamiento multi-tenant, además del filtro que ya hace cada query de la aplicación por
`iglesiaId`. Docs/supabase.md exigía resolver primero un caveat técnico antes de escribir
cualquier policy: Prisma no abre conexiones "como el usuario autenticado" — usa un
`PrismaClient` singleton con un único connection string, compartido por todo el backend.

**Hallazgo no anticipado por el plan original, resuelto en el camino:** el rol `postgres` de
`DATABASE_URL` en este proyecto de Supabase tiene el atributo `BYPASSRLS` (confirmado por
query — no es superusuario, pero Supabase se lo otorga igual). Con ese rol, activar RLS no
habría cambiado nada: Postgres ignora las policies para cualquier rol con `BYPASSRLS`,
`FORCE ROW LEVEL SECURITY` incluido. Se creó un rol nuevo, `app_runtime` (sin `BYPASSRLS`, sin
superusuario, solo `SELECT/INSERT/UPDATE/DELETE` sobre `public`; `postgres` sigue siendo el
dueño de las tablas y el rol para migraciones) y `DATABASE_URL` en `backend/.env` ahora conecta
como ese rol. **Pendiente real: alguien con acceso al dashboard de Render tiene que actualizar
`DATABASE_URL` ahí también** — esta sesión no tiene ese acceso, así que el backend desplegado
sigue conectando como `postgres` (sin protección real de RLS) hasta que se haga ese cambio.

**Mecanismo (código, `backend/src/`):**
- `common/context/tenant-context.ts`: `AsyncLocalStorage` con `usuarioId`/`iglesiaId`/`rol` por
  request, más `runAsService()` (bypass explícito y acotado, rol sentinel `'SERVICE'`).
- `common/middleware/tenant-context.middleware.ts`: arranca el contexto (vacío = anónimo,
  fail-closed) antes que cualquier guard, registrado en `app.module.ts`.
- `prisma/prisma.service.ts`: middleware de Prisma (`$use`, no `$extends` — decisión
  consciente, ver comentario en el archivo: extensions hubiera obligado a cambiar el tipo/token
  inyectado en los ~30 archivos que hacen `constructor(private readonly prisma: PrismaService)`;
  `$use` está deprecada a favor de extensions pero sigue soportada en la v5.x instalada)
  antepone `set_config` transaction-local a cada operación. Nuevo método
  `withTenantTransaction()` para los 8 sitios que ya abrían su propia transacción interactiva
  (`iglesias.service.ts` ×2, `bautizos/presentaciones/defunciones/matrimonios.service.ts`,
  `accesos.service.ts`, `finanzas-import.service.ts`, `onboarding.service.ts`) — evita el caso
  que Prisma advierte como roto ("explicitly running transactions with the extended client may
  not work as intended") fijando `set_config` una sola vez y marcando `inManagedTransaction` en
  el contexto para que el middleware no vuelva a envolver cada operación dentro.
- `JwtAuthGuard`/`RealtimeGateway#handleConnection`: pueblan el contexto con la identidad real
  apenas la resuelven — ambos resuelven primero un bootstrap por `usuarioId` (antes de conocer
  `iglesiaId`), que la policy de `usuarios` permite vía auto-lectura por `id`.
- Bypass explícito (`runAsService`, rol `'SERVICE'`) en los únicos puntos que legítimamente no
  tienen identidad de tenant: `AuthService#validateUser` (login, antes de resolver quién es),
  `AuthService#refreshTokens`/`login` (usan el contexto real una vez que ya lo conocen, no
  bypass), las 3 rutas 100% públicas por token (`PredicadoresService`, `AsistenciasService`,
  `IntegrantesService#getInvitacion`/`registrar`) y `FacturacionRecordatoriosCron` (cruza todas
  las iglesias a propósito).

**Migración SQL** (`backend/prisma/migrations/20260820181542_enable_rls_tenant_isolation/`):
`ENABLE`+`FORCE ROW LEVEL SECURITY` y una policy `tenant_isolation` en las 16 tablas con
`iglesiaId` (o `id` para `iglesias` misma), con casos especiales para `usuarios`/
`sesiones_actividad` (`iglesiaId` nullable + auto-lectura por id propio) y `predicadores`/
`asistencias_evento` (sin columna `iglesiaId`, scoped vía `EXISTS` contra `eventos`). 3
funciones helper (`app_iglesia_id()`, `app_usuario_id()`, `app_is_privileged()`) con
`search_path` fijo (get_advisors marcó WARN sin eso). `refresh_tokens` queda fuera a propósito
(tabla ya no usada tras el cutover de Fase 7, pendiente de DROP aparte).

**Cómo se aplicó, y qué falta reconciliar:** este entorno no tiene conectividad de red directa
a la base (`prisma migrate status` falla con P1001 incluso sin sandbox — confirmado que es una
restricción real del entorno, no de permisos), así que no se pudo generar la migración con
`prisma migrate dev --create-only` ni aplicarla con `prisma migrate deploy`. Se aplicó a mano
vía las herramientas MCP de Supabase (`execute_sql` para crear el rol `app_runtime`,
`apply_migration` para las policies) y se escribió el archivo `.sql` correspondiente en
`backend/prisma/migrations/` para que el historial del repo quede completo. **Pendiente:**
`_prisma_migrations` en la base real no sabe de este cambio — correr
`prisma migrate resolve --applied 20260820181542_enable_rls_tenant_isolation` la próxima vez
que alguien tenga conectividad directa (mismo criterio que ya pedía `docs/supabase-todo.md`
tras el incidente de la fila de migración corrupta).

**Verificación realizada:** `npx tsc --noEmit` limpio. Verificación de RLS a nivel SQL
(simulando `SET ROLE app_runtime` + `set_config` de los 3 escenarios) contra la base real:
(1) como MANAGER de una iglesia, una lectura sin filtro de `integrantes`/`usuarios` solo trae
filas de esa iglesia; un intento explícito de leer o actualizar otra iglesia devuelve 0 filas
aunque el query lo pida a propósito; (2) como `SUPER_ADMIN`, la misma lectura trae las 8 filas
de `usuarios` de las 3 iglesias de seed (confirmado contra el conteo real sin RLS); (3) sin
ningún contexto seteado, la lectura trae 0 filas (fail-closed). `get_advisors(security)` limpio
salvo hallazgos pre-existentes no relacionados (un trigger `rls_auto_enable()` que ya existía
en el proyecto de una sesión anterior, y RLS sin policy en `_prisma_migrations`/
`refresh_tokens`, ambas inofensivas — ver detalle en la conversación).

**No verificado en esta sesión, pendiente de confirmar con la app corriendo de verdad:** este
mismo entorno no puede levantar el backend contra la base real (mismo P1001 de arriba), así que
el mecanismo se probó a nivel SQL y de compilación, pero NO se probó end-to-end con requests
HTTP reales (login, las 3 rutas públicas por token, el dashboard de SuperAdmin, el cron, el
WebSocket). Alguien con conectividad directa a la base (local o Render, una vez actualizado
`DATABASE_URL` ahí) debería correr ese smoke test antes de confiar en que ningún flujo se rompió.

**Con esto, las 8 fases de docs/supabase.md quedan resueltas.** Actualizados
`docs/supabase.md` y `docs/supabase-todo.md` en la misma sesión.

## [2026-08-21 00:00] Eliminación del rol MIEMBRO + prompt de consentimiento (Ley 21.719) para el frontend

Dos pedidos del usuario en la misma sesión de consulta técnica (arquitectura, hosting,
git workflow): (1) sacar `MIEMBRO` del sistema — la decisión de producto es que solo
existen tres roles reales: `SUPER_ADMIN`, `MANAGER` y `USUARIO`; (2) dejar un prompt
reutilizable para que el equipo de frontend agregue una casilla de consentimiento en el
censo de integrantes, de cara a la Ley 21.719 de protección de datos personales (Chile),
que entra en vigencia el 1 de diciembre de 2026.

**Cambios — eliminación de `MIEMBRO`:**
- Antes de tocar nada, se confirmó contra la base real (`execute_sql`) que 0 filas de
  `usuarios` tenían `rol = 'MIEMBRO'` — la eliminación no requería migrar datos.
- `prisma/schema.prisma`: sacado `MIEMBRO` del enum `Rol`.
- `usuarios.service.ts`: sacada la entrada de `MIEMBRO` en `ORDEN_ROL` (orden de
  presentación del directorio del equipo); renumerado `SUPER_ADMIN` de 3 a 2.
- `auth.service.ts`, `jwt-payload.interface.ts`, `dashboard.controller.ts`: comentarios
  que mencionaban `MIEMBRO` como caso especial, corregidos (ninguno tenía código real
  que dependiera del valor, solo prosa desactualizada).
- Nueva migración `20260821035755_remove_rol_miembro`: Postgres no soporta `DROP VALUE`
  en un enum, así que se recreó el tipo (`RENAME` a `Rol_old` → `CREATE TYPE` nuevo sin
  `MIEMBRO` → `ALTER COLUMN ... USING` → `DROP TYPE Rol_old`). Se verificó primero que
  ninguna función/policy de RLS (Fase 8, migración anterior) dependiera del tipo `Rol` —
  `app_is_privileged()` compara un `current_setting` de texto contra literales, no el
  enum — así que este cambio no interactúa con la Fase 8. Aplicada a mano vía MCP de
  Supabase (mismo motivo que la migración de RLS: este entorno no tiene conectividad
  directa a la base). Verificado post-aplicación: `enum_range(NULL::"Rol")` devuelve
  exactamente `('SUPER_ADMIN','MANAGER','USUARIO')`, y las 8 filas de `usuarios`
  mantuvieron su rol intacto. **Pendiente, igual que con la migración de RLS:** correr
  `prisma migrate resolve --applied 20260821035755_remove_rol_miembro` la próxima vez
  que alguien tenga conectividad directa a la base.
- `README.md`: sacada la fila de `MIEMBRO` de la tabla de roles y el ítem correspondiente
  de "Pendientes conocidos"; de paso, corregido el ítem de RLS ahí mismo, que todavía
  decía "puede empezar ahora" — ya está implementada (ver entrada anterior), solo falta
  que `DATABASE_URL` en Render apunte al rol `app_runtime` en vez de `postgres`.
- `AGENTS.md`: actualizada la lista de roles actuales, sin `MIEMBRO`.
- `CLAUDE.md`: sacada la fila de `MIEMBRO` de la tabla de roles de negocio, con una nota
  fechada explicando la decisión. Se dejó sin tocar el resto de esa tabla (nombres
  `PASTOR`/`TESORERO`/`SECRETARIA`), que sigue sin coincidir con los nombres técnicos
  reales (`MANAGER`/`USUARIO`) — es una inconsistencia más amplia, ya señalada al
  usuario, que no formaba parte de este pedido.
- Verificación: `npx prisma generate` + `npx tsc --noEmit` limpio; sin tests que
  mencionaran `MIEMBRO`.

**Cambios — `prompt.md` (nuevo, raíz del repo):** prompt autocontenido para una sesión de
Claude Code sobre el repo del frontend — agrega un checkbox obligatorio (desmarcado por
defecto, bloquea el envío) antes del botón de enviar del formulario público de censo por
QR, con link a una política de privacidad todavía inexistente (URL placeholder
configurable). Incluye el contrato real del endpoint `POST /integrantes/registro/:qrToken`
(campos exactos del DTO) y advierte explícitamente que el `ValidationPipe` global
(`forbidNonWhitelisted: true`) rechaza cualquier campo nuevo en el body — por eso el
prompt indica que el consentimiento debe implementarse como gate 100% de cliente, sin
mandar nada nuevo al backend todavía. Nota aparte (fuera del prompt): falta un cambio de
backend separado para persistir *cuándo* y *qué versión* de la política aceptó cada
`Integrante` — sin eso el checkbox no es evidencia real de consentimiento ante una
fiscalización; no se implementó en esta pasada porque el pedido fue explícitamente para
frontend.

**Funcionalidad:** el sistema queda con exactamente los roles que el negocio quiere hoy
(sin una opción `MIEMBRO` que nunca tuvo uso ni endpoints), y el equipo de frontend tiene
instrucciones precisas y accionables para cumplir con el requisito de consentimiento de
la Ley 21.719 antes de su entrada en vigencia (1 de diciembre de 2026).

## [2026-08-21 00:20] Fix: la Fase 8 (RLS) rompía el backend al arrancar — `$use` no sirve para batchear con `$transaction`

El usuario corrió `nest start` localmente (con conectividad real a la base, a diferencia
de la sesión que implementó la Fase 8) y el backend crasheaba al primer intento de query
con `RangeError: Maximum call stack size exceeded` y, en el error de fondo real: `Error:
All elements of the array need to be Prisma Client promises. Hint: Please make sure you
are not awaiting the Prisma client calls you intended to pass in the $transaction
function.`, apuntando a `prisma.service.ts`.

**Causa real:** `PrismaService` usaba `$use` (Client Middleware) para anteponer
`set_config` a cada query, batcheando `[this.$executeRaw(set_config), next(params)]` en
un `this.$transaction([...])`. Eso está mal de raíz: `next(params)` en `$use` YA dispara
la ejecución de la query (devuelve una Promise nativa en curso), no la promesa perezosa
que `$transaction([...])` necesita para poder batchear — de ahí el error de Prisma. La
decisión de usar `$use` en vez de `$extends` (Client Extensions, el mecanismo que Prisma
sí soporta para este patrón) se tomó explícitamente en la entrada anterior para evitar
tener que cambiar el token/tipo inyectado en los ~30 archivos que hacen
`constructor(private readonly prisma: PrismaService)` — esa preocupación era válida, pero
la solución elegida (`$use`) no funciona para lo que se necesitaba.

**Fix:** reescrito `prisma.service.ts` para usar `$extends` de verdad —
`$allOperations({ args, query })` sí entrega en `query(args)` la promesa perezosa
correcta, confirmado contra el patrón oficial de Prisma
(`prisma/prisma-client-extensions/row-level-security`). Como `$extends` devuelve un
objeto nuevo (no `this` modificado in-place), `PrismaModule` cambió de
`providers: [PrismaService]` a un provider `useFactory` que entrega ese objeto bajo el
mismo token `PrismaService` — ningún otro archivo del backend cambió su forma de
inyectarlo. Para que TypeScript acepte ese objeto como del tipo `PrismaService` sin forzar
un cast en cada sitio, `PrismaService` pasó de ser una subclase de `PrismaClient` a una
clase vacía (`class PrismaService {}`) fusionada por declaración con una interfaz
(`interface PrismaService extends ExtendedPrismaClient {}`) que le da la forma completa
del cliente extendido — patrón que ESLint marca como "unsafe declaration merging"
(hay una razón real detrás de esa regla) pero es intencional y acotado a este único
archivo, documentado con comentarios y `eslint-disable` explícitos en el propio código.
`withTenantTransaction` (los 8 sitios con transacción interactiva propia) no necesitó
cambios de lógica: ya usaba el cliente `raw` sin pasar por el middleware, así que nunca
tuvo el bug — solo se movió de método de instancia a método del componente `client` de la
extensión.

**Verificación:** `npx tsc --noEmit` y `npx eslint "src/**/*.ts"` limpios tras el cambio.
Sigue sin poder probarse contra la base real desde esta sesión (mismo P1001 de siempre) —
el usuario es quien tiene que confirmar que ahora sí levanta y sirve requests.

**De paso, se registra que el repo tuvo trabajo concurrente de otra sesión/persona
mientras esta se ejecutaba** (retiro del rol `MIEMBRO` de `schema.prisma`/docs, prompt de
consentimiento de datos para el frontend) — ya documentado en la entrada anterior de esta
misma bitácora; se menciona acá solo porque `git status` lo mostró junto a este fix y vale
la pena que quede claro que esta entrada NO toca nada de eso.

**Funcionalidad:** sin este fix, absolutamente ninguna request a la API iba a funcionar
—el crash pasaba en la primera query que cualquier request disparara— así que era un
bug bloqueante de severidad máxima para todo lo entregado en la Fase 8, encontrado antes
de llegar a producción gracias a que el usuario probó el arranque real del backend.

## [2026-08-25 00:00] Infraestructura de staging: proyecto Supabase dedicado + rol `app_runtime`

El usuario creó la rama `staging` para hacer QA en un ambiente pre-producción (backend en
Render, frontend ya con un deploy de staging a Cloudflare Workers — ver
`frontend/FEATURES.md` 2026-08-25, que dejó pendiente exactamente esta misma decisión:
"¿`NEXT_PUBLIC_API_URL` apunta a un backend de staging separado o al mismo de
producción?"). Antes de tocar nada se le preguntó explícitamente cómo resolverlo, y eligió
un proyecto Supabase separado (no reusar el proyecto real `Backend`, que ya tiene cuentas
reales del fundador y del equipo — ver `local-postgres-demo-setup` en memoria).

**Cambios (fuera del repo, infraestructura de Supabase vía MCP):**
- El proyecto `Backend-auth-test` (`grcywqjcqwpbuekqbupj`, descartable, dedicado a probar
  el espejo de Supabase Auth de la Fase 7) se **pausó** — el plan free de la organización
  solo permite 2 proyectos activos y ya estaba en el tope (`Backend` + `Backend-auth-test`).
  Nada se perdió; se reanuda con un click cuando se retome esa fase.
- Proyecto nuevo `Backend-staging` (`woerftoeqarupnrggupl`, `ca-central-1`, plan free,
  $0/mes) creado en la misma organización.
- Rol `app_runtime` creado en ese proyecto (mismo patrón que ya existe en `Backend`, ver
  entrada del 2026-08-20 "RLS multi-tenant"): `login`, `noinherit`, sin `BYPASSRLS`, sin
  superusuario. `alter default privileges` ya deja configurado que cualquier tabla que
  `prisma migrate deploy` cree después (como rol `postgres`, dueño de las tablas) le otorgue
  automáticamente `select/insert/update/delete` a `app_runtime` — no hizo falta esperar a
  que las tablas existieran para dejarlo listo.
- Verificado con `npx prisma db execute --url ... --stdin` (`select 1`) contra el pooler
  IPv4 (`aws-0-ca-central-1.pooler.supabase.com:5432`, session mode, usuario
  `app_runtime.woerftoeqarupnrggupl`) que la conexión funciona end-to-end — mismo patrón de
  pooler recomendado en la sesión anterior para esquivar el P1001 por falta de IPv6 saliente
  en la red del usuario (ver conversación/memoria de esa sesión).

**Pendiente (fuera del alcance de esta sesión — requiere dashboards de Render/Cloudflare,
sin MCP disponible para ninguno de los dos):**
- Crear el Web Service de Render apuntando a la rama `staging` (root `backend`), con
  `DATABASE_URL` = conexión `app_runtime` de arriba, un Pre-Deploy Command que corra
  `prisma migrate deploy` con una conexión `postgres` elevada (el usuario debe sacarla del
  dashboard de `Backend-staging` — el rol `postgres` de un proyecto nuevo no es recuperable
  vía MCP), y `CORS_ORIGIN` apuntando al dominio que resulte del deploy de Cloudflare
  Workers del frontend.
- Buckets de Supabase Storage (logos/fotos) no están replicados en `Backend-staging` — si
  QA sube logos/fotos, hoy no hay dónde guardarlos ahí; pendiente decidir si se crean en
  este proyecto o si staging reusa los buckets de `Backend` (que ya tienen archivos reales).
- Seed de datos demo en `Backend-staging` (`npm run prisma:seed`) — puede correr recién
  después del primer `prisma migrate deploy` exitoso, con la URL `app_runtime` (alcanza,
  seed es solo DML).
- `SUPABASE_AUTH_TEST_*` deliberadamente sin configurar en el Render de staging: con
  `Backend-auth-test` pausado no serviría igual, y como esas variables son opcionales
  (`SupabaseAuthService` queda no-op sin ellas) no bloquea el resto del login/JWT propio.

**Funcionalidad:** deja lista la mitad de la infraestructura de staging que sí se puede
resolver sin acceso a Render/Cloudflare (base de datos aislada de los datos reales de
producción, con el mismo modelo de permisos `app_runtime`/RLS que ya corre — parcialmente
activado — en producción), documentado para que la próxima sesión (o el usuario) retome
exactamente donde quedó en vez de tener que reconstruir el contexto.

## [2026-08-25 22:10] Backend de staging en Render: deploy completo y funcionando

Continuación de la entrada anterior — el usuario pidió instalar el MCP de Render
(`https://mcp.render.com/mcp`, auth por header con un API key de cuenta, ya que el OAuth
por defecto de Claude Code no es compatible con el servidor de Render) y usarlo para
terminar la configuración. Con eso más el trabajo manual del usuario en el dashboard,
quedó un backend de staging real y verificado en `https://evangelicapp-backend.onrender.com`
(rama `staging`, servicio `srv-da700lq6iojc7380qmjg`, plan free).

**Estado del servicio al empezar esta entrada:** ya existía (creado por el usuario ese
mismo día, siguiendo la guía de la entrada anterior) pero con 2 deploys fallidos —
Root Directory `backend/src` (sin `package.json` ahí) y Build/Start Command genéricos de
Render (`yarn`/`yarn start`, este repo no tiene `yarn.lock`). El usuario corrigió esos 3
campos a mano en el dashboard (Root Directory `backend`, Build Command
`npm install && npx prisma generate && npm run build`, Start Command `npm run start:prod`)
porque el MCP de Render no expone esos campos para un servicio ya creado (`create_web_service`
tampoco tiene un parámetro de root directory — limitación real de la herramienta, no algo
que se pueda resolver por API).

**Bugs reales encontrados y corregidos, en orden, cada uno bloqueando el siguiente:**

1. **`NODE_ENV=production` rompe el build de Nest.** `npm install` con esa env var
   presente salta las `devDependencies` (comportamiento documentado de npm, no un bug de
   Render) — `@nestjs/cli` vive ahí, así que `nest build` fallaba con `sh: 1: nest: not
   found`. `prisma generate` no fallaba porque corre vía `npx` (que descarga el paquete al
   vuelo si falta); `nest build` se invoca directo, sin ese fallback. Fix: variable
   `NPM_CONFIG_PRODUCTION=false` (seteada vía MCP), que fuerza a npm a instalar
   devDependencies igual sin tocar `NODE_ENV` (que sí se necesita en `production` en
   runtime, para las cookies `Secure`/`SameSite=None`).
2. **Base de datos completamente vacía.** El campo **Pre-Deploy Command** (donde iba
   `prisma migrate deploy`) nunca se configuró — ni por el usuario en el dashboard ni por
   mí (el MCP tampoco lo expone). En vez de agregar un cuarto campo manual más, corrí
   `npx prisma migrate deploy` yo mismo desde esta sesión contra el pooler de
   `Backend-staging` (rol `postgres`, connection string que el usuario sacó del dashboard
   de Supabase) — las 15 migraciones se aplicaron limpio, incluida la de RLS. Pendiente
   real: sigue sin existir un Pre-Deploy Command en Render, así que una migración nueva
   que se agregue más adelante no se va a aplicar sola en el próximo deploy — hay que
   correrla a mano (yo o quien tenga la connection string de `postgres`) o agregar ese
   campo en el dashboard.
3. **`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no son opcionales.** A diferencia de
   `SUPABASE_AUTH_TEST_*`, `SupabaseStorageService` las pide con `getOrThrow` en el
   constructor de un módulo `@Global()` — sin ellas el proceso entero moría al bootear
   (`TypeError: Configuration key "SUPABASE_URL" does not exist`), aunque el build/deploy
   en sí mismo apareciera "live" un momento antes de crashear. Se crearon los 4 buckets de
   Storage en `Backend-staging` (mismos nombres/límites/mimetypes que producción:
   `logos-iglesias`, `fotos-perfil`, `fotos-integrantes`, `certificados-ceremonias`) vía
   `execute_sql` sobre `storage.buckets`, y se setearon ambas variables apuntando a ese
   proyecto — mismo criterio de aislamiento que ya se había elegido para la base de datos.
4. **Hallazgo más importante: `SUPABASE_AUTH_TEST_*` dejaron de ser opcionales desde el
   "cutover final" de Fase 7 (commit `21a01f83`), pero el comentario de `.env.example`
   nunca se actualizó.** `AuthService#validateUser` exige una sesión válida de
   `signInWithPassword` para CUALQUIER login — el fallback a bcrypt local solo decide si
   hay que sincronizar la contraseña hacia Supabase Auth, no reemplaza esa sesión. Sin esas
   3 variables, todo login responde `401 Credenciales inválidas` (mensaje genérico, no
   distingue "Supabase Auth no configurado" de "contraseña incorrecta" — visto en los logs
   de Render: `signInWithPassword falló ... Supabase Auth no está configurado`). Corregido
   `backend/.env.example` para que el comentario refleje la realidad actual, y resuelto en
   staging apuntando `SUPABASE_AUTH_TEST_URL/SERVICE_ROLE_KEY/ANON_KEY` al mismo proyecto
   `Backend-staging` (cualquier proyecto Supabase trae Auth incluido — no hace falta un
   proyecto dedicado solo para esto, así que no se tocó el límite de 2 proyectos free ni
   se volvió a pausar `Backend-auth-test`).

**Verificado de punta a punta contra el servidor real:** `npx prisma:seed` corrido contra
`Backend-staging` (con el rol `postgres`, no `app_runtime` — el seed hace `upsert` directo
sin pasar por `runAsService()`, así que con `app_runtime` la policy RLS de `iglesias`
rechazaba el insert con `42501 new row violates row-level security policy`, comportamiento
esperado y correcto, no un bug). `POST /auth/login` real contra
`https://evangelicapp-backend.onrender.com` con las credenciales del seed
(`admin@evangelicapp.cl` / `SuperAdmin123`) devuelve `200`, cookies `access_token`/
`refresh_token`/`csrf_token` con `Secure`/`SameSite=None` correctos, y el JWT de Supabase
trae `app_metadata.rol: SUPER_ADMIN` y `usuarioId` correctos.

**Pendiente real, sin resolver en esta sesión:**
- Pre-Deploy Command en Render (ver bug 2) — cualquier migración futura necesita correrse
  a mano hasta que se configure.
- Deploy del frontend a Cloudflare Workers (`evangelicapp-frontend-staging`, ver
  `frontend/wrangler.jsonc`) — sigue sin mecanismo de deploy conectado. Una vez que exista
  esa URL, falta setear `CORS_ORIGIN`/`FRONTEND_URL` en este servicio de Render (hoy sin
  configurar, así que cualquier request cross-origin desde un frontend real todavía
  fallaría por CORS).
- El API key de Render (`rnd_...`) que el usuario pegó en el chat da acceso a **toda la
  cuenta** de Render (todos los servicios, no solo este), no solo a este proyecto —
  vale la pena que el usuario lo rote si en algún momento deja de necesitar que Claude
  tenga ese nivel de acceso.

**Funcionalidad:** hay un backend de staging real, aislado de los datos de producción
(Postgres, Storage y Auth en un proyecto Supabase separado, `Backend-staging`), corriendo
en Render y verificado con un login real de punta a punta — listo para que el frontend de
Cloudflare Workers lo consuma apenas tenga su propia URL de deploy.

## [2026-08-26 22:15] Fix real de CORS de staging + hallazgo y fix de un bug de RLS en producción (módulos de USUARIO)

**Cambios — CORS del frontend recién desplegado:**
- `CORS_ORIGIN`/`FRONTEND_URL` en el Render de staging, sin configurar hasta ahora, se
  setearon a `https://evangelicapp.rojascofrem.workers.dev` (URL real del deploy de
  Cloudflare Workers del frontend) — resolvía el error de CORS que el usuario vio al
  probar el login desde ese dominio.

**Investigado y explicado (sin cambios de código):** el usuario reportó que el login
funcionaba en su PC pero lo "botaba" del dashboard al probar desde el celular o desde otro
computador. Diagnóstico: no es un bug — los navegadores mobile/Safari bloquean por defecto
las cookies "de terceros" (cross-site, `SameSite=None`) entre `onrender.com` y
`workers.dev`, dos dominios sin relación. El login inicial funciona (trae el usuario en el
body de la respuesta), pero la cookie de sesión nunca queda guardada en esos navegadores,
así que la siguiente request autenticada falla con 401 y la app redirige a login. Fix real
requeriría un dominio propio compartido entre frontend/backend (mismo *site*); el usuario
confirmó que por ahora solo necesita poder probar desde su propio equipo, así que se dejó
así a propósito — no se tocó código.

**Preparación de datos de QA:** además de las 3 iglesias demo del seed (`igl_demo`
PRO/verde, `igl_valpo` MEDIO/amarillo, `igl_conce` BASICO/en mora — los 3 semáforos de
facturación posibles, sin tener que crear nada nuevo), se agregaron 3 usuarios `USUARIO`
vía SQL directo (uno por iglesia, `mustChangePassword: false` para no bloquear las pruebas
automatizadas): `tesorero_demo` (los 4 módulos), `secretaria_valpo` (solo `AGENDA`),
`usuario_conce` (ningún módulo) — pensados para cubrir acceso total, acceso parcial y
acceso nulo.

**QA automatizado contra el servidor real** (`backend/src` no tiene suite de integración
propia todavía, así que se armó un script ad-hoc en Node con `fetch` nativo, manejo manual
de cookies/CSRF, no commiteado al repo — vive en el scratchpad de la sesión): 7 logins,
control de acceso por módulo (`ModuloAccessGuard`), aislamiento multi-tenant (crear un
evento con un usuario y confirmar que otro tenant no lo ve ni en detalle ni en el listado ni
puede borrarlo), que `SUPER_ADMIN` no vea campos financieros en el detalle de una iglesia,
CSRF (mutación sin token → 403), ciclo completo de mora (`ocultar` → login bloqueado →
`mostrar` → login restaurado), y rate limiting de `/auth/login` (12 intentos seguidos
activan el 429 documentado).

**Bug real encontrado y corregido — `backend/src/common/guards/jwt-auth.guard.ts`:**
`tesorero_demo` (con `FINANZAS` otorgado) y `secretaria_valpo` (con `AGENDA` otorgado)
recibían `403 Forbidden resource` incluso en el ÚNICO módulo que sí tenían permitido. Causa
raíz: `JwtAuthGuard` pedía `accesosPropios` como `include` anidado en el mismo
`prisma.usuario.findUnique(...)` que resuelve `iglesiaId`/`rol`, pero
`updateTenantContext({ iglesiaId, rol })` recién se llamaba DESPUÉS de que ese query
completara — la policy RLS de `accesos_modulo` exige `iglesiaId` en el contexto de tenant
para devolver filas, así que ese `include` corría siempre con el contexto viejo (solo
`usuarioId`, sin `iglesiaId`) y RLS lo filtraba a 0 filas siempre, sin importar los accesos
reales de ningún usuario. Confirmado con una simulación SQL directa (mismos `set_config`
que usa el guard, en el mismo orden exacto) antes de tocar código: con solo `usuario_id`
seteado, la query de `accesos_modulo` devuelve `[]`; con `iglesia_id`/`rol` ya seteados,
devuelve las filas reales. **Por qué nunca se vio antes:** en producción `DATABASE_URL`
todavía conecta como `postgres` (con `BYPASSRLS`, pendiente ya documentado en `README.md`),
así que RLS nunca se aplicaba de verdad ahí — este bug estaba completamente
enmascarado y recién se hizo visible al correr con `app_runtime` real por primera vez en
este entorno de staging. **Fix:** se separó `accesoModulo.findMany(...)` en una query aparte,
ejecutada después de `updateTenantContext(...)`, y solo para `rol === USUARIO` (MANAGER/
SUPER_ADMIN no la necesitan, `modulos` les queda `[]` igual que antes). Verificado con
`npx tsc --noEmit` limpio y con el mismo script de QA de arriba, corrido antes y después del
fix contra el servidor real: 2 checks que fallaban (más otros 2 que dependían de ellos)
pasan a estar en verde tras el fix, sin tocar ningún otro comportamiento.

**Impacto real de este bug si no se hubiera encontrado acá:** el día que `README.md`
complete su pendiente de pasar `DATABASE_URL` de producción a `app_runtime` (necesario para
que RLS proteja de verdad), el módulo completo de Accesos (`USUARIO` con permisos
delegados) se habría roto en producción de un día para otro — ningún `USUARIO` habría
podido usar ningún módulo, sin importar qué accesos tuviera otorgados, y nadie lo habría
detectado hasta que un cliente real reportara "no puedo ver nada" tras el cutover.

**Datos de prueba:** los 2 eventos creados durante el QA (uno por tenant, para probar el
aislamiento) se borraron al terminar. Los 3 usuarios `USUARIO`/3 iglesias del seed quedan
en `Backend-staging` a propósito, para que el usuario los siga usando en sus propias
pruebas.

**Funcionalidad:** además de dejar el CORS de staging funcionando con la URL real del
frontend, este QA encontró y cerró un bug de severidad alta que iba a golpear producción en
el momento exacto en que RLS pasara a estar realmente activo ahí — exactamente el escenario
que `CLAUDE.md` pide cuidar ("no romper el aislamiento multi-tenant bajo ninguna
circunstancia"), aunque en este caso el efecto era "romper el acceso legítimo", no una fuga
de datos entre iglesias (esa garantía, la de aislamiento entre tenants, se probó aparte y
quedó confirmada intacta).

## [2026-08-27 02:30] QA de staging, ronda 2: carga con k6 + flujo de contraseña, límites de plan, refresh token, SQLi

**MCP instalado (fuera del repo):** `grafana/mcp-k6` vía Docker (`docker run --rm -i
grafana/mcp-k6`, scope local, no commiteado) — el usuario pidió explícitamente probar con
"Grafana"; se le aclaró que el MCP es de k6 (herramienta de carga), no del Grafana de
escritorio que tiene instalado (producto distinto de la misma empresa).

**Carga contra el servidor real de staging** (`https://evangelicapp-backend.onrender.com`,
free tier — intensidad deliberadamente moderada para no abusar de infra compartida):
- 15 VUs / 30s contra `POST /auth/login`: 348 requests, 0 errores 5xx, latencia p95 de
  login exitoso ~2.7s. El 92% recibió 429 — el rate limit (10/min) funcionando exactamente
  como debe bajo concurrencia, no una caída del servidor.
- 20 VUs / 30s de lecturas autenticadas contra `GET /agenda/eventos`: 318 requests, 0
  errores 5xx, solo 2 recibieron 429 (rate limit global de 120/min). El servidor no se cae
  ni se degrada de forma anómala bajo esta carga.

**Resto de casos de QA pedidos ("continua con todos los tests"), contra el servidor real:**
- Flujo de cambio de contraseña obligatoria (`lfuentes`): bloqueado correctamente en
  cualquier endpoint fuera del allowlist mientras `mustChangePassword=true`;
  `PATCH /auth/change-password` funciona y desbloquea el resto de la API.
- Límite de plan (`PLAN_LIMITES`): con `igl_conce` en plan BÁSICO (tope 3 usuarios), crear
  el 3er usuario funciona (201) y el 4to falla con `403 PLAN_LIMITE_USUARIOS` — el tope se
  aplica de verdad, no solo en el frontend.
- Intento de SQL injection en `GET /iglesias?search=...`: un payload con keywords obvias
  (`DROP TABLE`) fue bloqueado por el WAF de Cloudflare delante de Render (403 "Blocked",
  ni siquiera llega a la app) — repetido con payloads más suaves (`O'Brien`,
  `' OR '1'='1`, `UNION SELECT`) que sí llegan a la app: todos devuelven `200` con
  resultado vacío, nunca un error de SQL — Prisma parametriza correctamente, sin
  inyección posible por esta vía.
- Rotación de refresh token: inicialmente falló con `403 "Origen no permitido"` — no es un
  bug, es `RefreshOriginMiddleware` (protección adicional no documentada hasta ahora en
  esta sesión: exige header `Origin` válido en `/auth/refresh` específicamente, más allá
  del CSRF normal). Con el header correcto, el refresh sí rota el token (valor viejo ≠
  nuevo).

**Hallazgo sin resolver, a seguir de cerca:** el refresh token *viejo* (ya marcado
`revoked = true` en `auth.refresh_tokens` de Supabase, confirmado por SQL directo) siguió
siendo aceptado por `POST /auth/refresh` incluso **20 segundos después** de haber rotado —
más allá de lo que normalmente dura una ventana de gracia por race conditions entre
pestañas. No se pudo confirmar en esta sesión si es el "Refresh Token Reuse Interval" de
este proyecto de Supabase configurado más largo de lo esperado, o si la detección de reuso
simplemente no está aplicándose. Recomendado: revisar ese setting en el dashboard de
Supabase Auth del proyecto (`Backend-staging` hoy; el mismo proyecto real cuando se
retome Fase 7 en producción) antes de confiar en que un refresh token robado se invalida
solo.

**Datos de prueba:** queda un usuario más en `igl_conce` (`qa_usr_conce_2`, tercer usuario
del plan BÁSICO, usado para probar el límite) — se deja a propósito, junto con el resto de
los usuarios de QA de la entrada anterior. `lfuentes` quedó con la contraseña cambiada a
`NuevaClave123` (ya no `Temporal123`) como parte de probar ese flujo.

**Funcionalidad:** confirma que el backend de staging aguanta carga concurrente moderada
sin caerse (ni en el gate de login ni en lecturas autenticadas), que los límites de plan y
las protecciones contra SQLi/CSRF/origin-spoofing funcionan como se documentaron, y deja
una pregunta concreta y accionable sobre la ventana de reuso de refresh tokens para revisar
antes de confiar en esa garantía en producción.
