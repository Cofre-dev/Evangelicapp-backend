# Red de iglesias y plan GRATUITO (backend)

Implementado el 2026-11-27 (ver `FEATURES.md`). **No se documenta en la tesis** (decisión del
autor). Instrucciones para el frontend: `prompt.md` en la raíz del repo.

## Decisiones del fundador (2026-11-26)

1. Plan **gratuito con límites**, para que el plan de pago tenga sentido.
2. Iglesia que deja de pagar → **baja al plan gratuito** (no se bloquea).
3. **Sin donaciones en dinero** por ahora (ni en las necesidades ni en pasarela).
4. **Lo gratuito es la red y su feed**; todo lo demás (agenda, finanzas, ceremonias,
   integrantes, notas, equipo, dashboard, reporte a la congregación…) es de pago.
5. Verificación (propuesta aceptada): toda iglesia puede usar la red apenas confirma su correo,
   con la insignia "sin verificar"; el SuperAdmin la verifica a mano. Las de pago nacen verificadas.

## Plan GRATUITO

- `PlanIglesia.GRATUITO`. Topes en `common/constants/plan.ts`: 1 usuario, 0 departamentos,
  **2 llamados abiertos** a la vez (Básico 5, Medio 10, Pro 30).
- **Bloqueo por defecto** (default-deny): `JwtAuthGuard` rechaza con 403
  `{ code: 'REQUIERE_PLAN_PAGO' }` toda ruta autenticada de una iglesia GRATUITO que no lleve
  `@PermitidoEnPlanGratuito()`. Lo llevan: `red/*`, `notificaciones/*`, `auth/*` (perfil propio,
  logout, contraseña), `onboarding`, `mi-iglesia/*` y `realtime/token`. Un módulo nuevo nace "de
  pago" sin tener que acordarse de bloquearlo. El plan se lee fresco en cada request: pagar o caer
  en mora cambia el acceso al instante.
- `proximaFacturacion` es opcional y se ignora en GRATUITO (`estadoFacturacionDe` devuelve
  `facturacion: null`).
- **Mora → GRATUITO:** `FacturacionRecordatoriosCron` (9:00 diario) llama a
  `IglesiasService#degradarPorMora` al cumplirse `DIAS_GRACIA_MORA` (3) días de mora: guarda el
  plan en `planPrevioMora`, pasa a GRATUITO, avisa en la campana y por correo. `marcarPagada`
  restaura `planPrevioMora` y cuenta el nuevo ciclo desde el día del pago. Marcar pagada una
  iglesia GRATUITO sin plan previo da 400 (hay que usar "cambiar plan").
- **Contratar:** `PATCH /iglesias/:id/plan` desde GRATUITO a un plan de pago fija la facturación
  a hoy + 30 días, registra el pago en el historial y verifica la iglesia.
- El cron del reporte financiero ignora las iglesias GRATUITO.
- `PATCH /iglesias/:id/ocultar` (SUSPENDIDA) sigue existiendo como herramienta manual.

## Registro autoservicio

1. `POST /red/registro` (público, 5 por IP cada 15 min, captcha Cloudflare Turnstile si existe
   `TURNSTILE_SECRET_KEY`): valida, verifica que el correo y el usuario estén libres, guarda una
   `SolicitudRegistroIglesia` (contraseña ya hasheada, token como sha256) y manda el link
   `FRONTEND_URL/registro/confirmar/:token` (24 h). **No crea nada más.**
2. `POST /red/registro/confirmar/:token`: crea en una transacción la iglesia (GRATUITO,
   `origen: AUTOSERVICIO`, sin verificar, sin facturación), el pastor `MANAGER` (sin contraseña
   temporal, onboarding pendiente) y su perfil de red visible. Idempotente.
3. El pastor inicia sesión normal (el espejo en Supabase Auth se crea en el primer login).

Región/comuna se validan contra `common/constants/chile-regiones.ts` (copia del catálogo del
frontend) y se guardan con el nombre canónico. `MiIglesiaService#update` también lo exige ahora.

## Modelo de datos (migración `20261127120000_red_de_iglesias`)

| Tabla | Qué guarda |
|---|---|
| `perfiles_red` | Cara pública de cada iglesia: copia de nombre/comuna/región/logo/verificada (sincronizada por `sincronizarPerfilRed`) + descripción, contacto, `visible` (solo afecta el listado del directorio) |
| `llamados_ayuda` | Llamado de ayuda: tipo, visibilidad (`COMUNA`/`REGION`/`NACIONAL`/`ALIADAS`), estado (`ABIERTO`/`CUBIERTO`/`CERRADO`), lugar, fechas, `ocultoModeracion` |
| `necesidades_llamado` | Metas concretas (voluntarios, insumos, servicio, otro), con `cantidadMeta` opcional |
| `compromisos_apoyo` | El "¡Yo te ayudo!": iglesia que ayuda, necesidad, cantidad, mensaje, estado |
| `alianzas` | Solicitud/alianza entre dos iglesias (`PENDIENTE`/`ACEPTADA`/`RECHAZADA`) |
| `notificaciones` | Campana: una fila por usuario destinatario |
| `reportes_red` | Reportes de llamados para el SuperAdmin |
| `solicitudes_registro_iglesia` | Registros pendientes de confirmar |

Además: `iglesias.planPrevioMora/origen/verificada/verificadaEn`, `usuarios.notificacionesRedEmail`.
Backfill: las iglesias existentes quedan verificadas y con su perfil fuera del directorio.

## Seguridad entre iglesias (RLS)

Primera funcionalidad que cruza datos entre iglesias. **Ninguna policy existente se tocó**; las
tablas nuevas tienen las suyas:

- Leer: cualquier iglesia autenticada lee perfiles, llamados no ocultos (los `ALIADAS` solo si hay
  una alianza aceptada), sus necesidades y sus compromisos. Sin contexto de tenant no se ve nada.
- Escribir: solo lo propio (perfil, llamados y necesidades propias, compromisos de la propia
  iglesia). Alianzas: solo las dos partes. Notificaciones/reportes: por iglesia. Solicitudes de
  registro: solo `runAsService`.
- Bypass acotado (`runAsService`): crear notificaciones para otras iglesias (`RedAvisosService`),
  pasar un llamado ajeno a CUBIERTO/ABIERTO según los apoyos (`RedService#reevaluarCobertura`) y el
  registro público. **Ojo:** el `await` de una query de Prisma tiene que quedar dentro del callback
  de `runAsService` (las queries son perezosas; si se devuelven sin esperar, corren con el
  contexto del request).
- Nunca se lee la tabla `iglesias` de otra iglesia: la cara pública es `perfiles_red`.
- La visibilidad `COMUNA`/`REGION` decide a quién le aparece en el feed y a quién se notifica; no
  es un secreto (cualquier iglesia puede abrir un llamado no-ALIADAS por su id).

**Arreglo de paso en `JwtAuthGuard`:** la iglesia del usuario se leía como `include` antes de fijar
`iglesiaId` en el contexto, así que RLS la devolvía siempre `null`: el bloqueo por `SUSPENDIDA` no se
aplicaba por request (solo en el login). Ahora es una query aparte, después de fijar el contexto.

## Notificaciones

`RedAvisosService#avisarAIglesias`: fila en `notificaciones` para cada usuario activo de las
iglesias destino, evento realtime `notificacion:nueva` al tenant y correo (de a 2 por segundo) a
quienes tienen `notificacionesRedEmail`. Destinos:

| Evento | A quién |
|---|---|
| Llamado nuevo `COMUNA` | Iglesias activas de esa comuna |
| Llamado nuevo `REGION` / `NACIONAL` | Iglesias activas de esa región (el feed nacional no notifica a todo el país) |
| Llamado nuevo `ALIADAS` | Aliadas |
| Apoyo nuevo / llamado cubierto / apoyo cancelado (sin correo) | Dueña del llamado |
| Alianza solicitada / aceptada | La otra iglesia |
| Iglesia verificada / plan degradado | Equipo de esa iglesia |

## Cómo se probó (2026-11-27)

Postgres 16 local (`backend/docker-compose.yml`) con las 22 migraciones, la API conectada como
`app_runtime` (RLS real) y un emisor de tokens de Supabase falso (JWKS ES256 local). 105 pruebas de
punta a punta (plan gratuito, directorio, feed por alcance, avisos, compromisos y cobertura,
alianzas y llamados ALIADAS, intentos de cruzar datos directo en SQL como `app_runtime`, moderación,
notificaciones, verificación, contratar plan, registro y confirmación) + corrida del cron de
facturación (degradación por mora y restauración al pagar) + bloqueo por SUSPENDIDA. Sin probar:
envío real de correos (SMTP local apagado), Turnstile real y Supabase Realtime.

## Pendientes

- Aplicar la migración en producción (probarla antes en un branch de Supabase: toca RLS).
- `TURNSTILE_SECRET_KEY` en Render (sin ella, el registro funciona sin captcha).
- Las comunas del catálogo se reconstruyeron de memoria: verificar contra SUBDERE/INE.
- Limpieza de `solicitudes_registro_iglesia` vencidas (hoy quedan en la tabla, sin efecto).
- WhatsApp y SMS para los avisos de la red: no implementados (WhatsApp exige plantillas
  aprobadas por Meta).
- Donaciones en dinero: fuera de esta etapa.
