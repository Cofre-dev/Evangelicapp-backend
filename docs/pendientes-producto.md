# Pendientes de producto (ideas aprobadas, sin fecha)

Ideas que el fundador validó como buenas pero que **no se están implementando todavía**.
Antes de empezar cualquiera, releer este archivo, confirmar las decisiones abiertas con el
fundador y bajar el diseño a schema/endpoints/RLS. Al implementar una, moverla a "Hechas" con
la fecha y la referencia a `FEATURES.md`.

Registrado el 2026-11-24 (conversación de diseño, sin código).

> **Estas dos features NO SE DOCUMENTAN todavía** (decisión del autor, 2026-11-26): no van en la
> documentación de la tesis (Daily, Product Backlog, sprints, informe ni presentación). Se
> documentarán después, cuando el autor lo pida explícitamente.

**Orden recomendado:** partir por el **reporte financiero (1)**. Es acotado, reutiliza
`Integrante`, `finanzas` y `mail`, no toca el modelo de tenant y sirve para dejar listos el job
programado y los envíos masivos, que la red de alianzas (2) también va a necesitar.

---

## 1. Reporte financiero voluntario a la congregación

> **Estado (2026-11-26): backend implementado** (ver `FEATURES.md` de esa fecha). Falta: el
> frontend (instrucciones en `prompt.md`, en la raíz del repo) y aplicar la migración
> `20261126120000_add_reporte_financiero_congregacion` (branch de Supabase → producción).
> Decisiones tomadas: cron dentro de Nest (`@nestjs/schedule`, ya estaba instalado; día 1 a las
> 10:00 de Chile, con reintento hasta el día 7), solo correo (sin WhatsApp), solo mensual,
> consentimiento opt-in únicamente desde el formulario del QR.

**Qué es:** un interruptor que el pastor activa voluntariamente para enviar por correo un
reporte de las finanzas de la iglesia a sus congregantes.

**Diseño propuesto:**

- **Destinatarios:** `Integrante` (ya tiene `email` y `telefono`, único por iglesia).
- **Configuración en `Iglesia`:** `reporteFinancieroActivo`, `frecuencia` (mensual por
  defecto), `activadoPor` / `activadoEn` para trazabilidad. Solo el `MANAGER` puede activarlo.
- **Vista previa + "Enviar ahora"** antes de activar el envío automático.
- **Contenido solo agregado:** ingresos/egresos totales, totales por categoría, saldo del
  período. **Nunca diezmos u ofrendas por persona** (línea roja). Opción para ocultar
  categorías sensibles.
- **Envío programado** mensual, en lotes (batch de Resend), guardando una "foto" del reporte.
- **Tabla `EnvioReporte`** con `@@unique([iglesiaId, periodo])`: idempotencia ante reintentos
  e historial de envíos.
- **Consentimiento y baja:** campo `recibeReportes` en `Integrante`, checkbox en el formulario
  de censo y link "dejar de recibir" en cada correo (Ley 19.628 y Ley 21.719).
- Queda en los **planes pagados** (depende del módulo de finanzas).

**Decisiones abiertas:**

- Job programado: `@nestjs/schedule` (dependencia nueva) vs. Cron Job de Render que llama a un
  endpoint protegido (preferido, porque el servicio puede quedar dormido).
- ¿Solo correo, o también resumen por WhatsApp?

---

## 2. Red de alianzas entre iglesias (módulo gratuito)

**Qué es:** un módulo para que las iglesias se conecten y se pidan ayuda para acciones
sociales u operativos (voluntarios, donaciones, insumos). **No es una copia de Facebook:** la
unidad central es la **necesidad con metas concretas**, no el post (sin likes ni comentarios).

**Decisión del fundador:** es un **módulo aparte y gratuito**. Cualquier iglesia puede
registrarse sola y usar la red sin pagar suscripción; los módulos de gestión (agenda,
finanzas, ceremonias, integrantes) son lo que se paga. La red funciona como canal de
adquisición hacia los planes pagados.

### Arquitectura recomendada

**Misma plataforma, con un plan gratuito que solo habilita la red** (no un servicio o base de
datos separada: eso duplicaría identidades y cuentas para las iglesias que pagan). Al pasar a
un plan pagado, la iglesia conserva su cuenta, su historial y sus alianzas.

### Cambios necesarios en el modelo actual

1. `PlanIglesia`: agregar `GRATUITO` (o `RED`); revisar `PLAN_LIMITS` y los guards.
2. `Iglesia.proximaFacturacion` pasa a nullable (y la lógica de pagos de `IglesiasService`).
3. Nueva capa de "módulos contratados por la iglesia según su plan" (hoy `ModuloSistema` +
   `AccesoModulo` solo sirven para que el MANAGER delegue a un USUARIO).
4. Mora: evaluar que una iglesia que deja de pagar **baje al plan gratuito** en vez de quedar
   `SUSPENDIDA` sin login (cambio de política de negocio).
5. **Registro autoservicio:** crea iglesia + pastor `MANAGER` en una sola transacción (mantiene
   la regla "no existe iglesia sin pastor"), con verificación de correo, captcha (ej.
   Cloudflare Turnstile) y rate limit.

### Aislamiento multi-tenant (crítico)

Es la primera funcionalidad que cruza datos entre iglesias. **No relajar ninguna policy RLS
existente**: todo lo compartido vive en tablas nuevas con sus propias policies, y el
directorio nunca lee `Iglesia` directamente, sino un perfil público opt-in.

### Verificación de iglesias (crítico, por riesgo de estafa con donaciones)

- **Registrada (sin verificar):** perfil, búsqueda, alianzas, pedir voluntarios/insumos,
  ofrecer ayuda.
- **Verificada (insignia):** además puede pedir **donaciones en dinero**. La verifica el
  SuperAdmin (ej. personalidad jurídica de entidad religiosa, Ley 19.638, o referencia de otra
  iglesia verificada). Las iglesias que pagan quedan verificadas de inmediato.
- Botón "reportar"; el SuperAdmin puede ocultar convocatorias y suspender perfiles.

### Modelo de datos (borrador)

| Tabla | Para qué |
|---|---|
| `PerfilPublicoIglesia` | Lo que la iglesia elige mostrar (nombre, comuna, descripción, contacto) + `visible` |
| `Alianza` | Solicitante, receptora, estado (`PENDIENTE`/`ACEPTADA`/`RECHAZADA`/`BLOQUEADA`), par único |
| `Convocatoria` | Título, descripción, fecha, comuna, tipo, visibilidad (`ALIADAS`/`COMUNA`/`REGION`), estado (`ABIERTA`/`CUBIERTA`/`CERRADA`) |
| `NecesidadItem` | Metas concretas: "20 voluntarios", "100 kg de alimentos", "$300.000" |
| `CompromisoApoyo` | El "¡Yo te ayudo!": iglesia, item, cantidad, mensaje |
| `Notificacion` | Notificaciones in-app por usuario |

Cada necesidad muestra su avance ("14/20 voluntarios, 3 iglesias apoyando"); cuando todo está
cubierto, la convocatoria pasa a `CUBIERTA`.

### Notificaciones

- In-app y feed en vivo con el módulo `realtime` existente.
- Correo con el módulo `mail` existente.
- WhatsApp con el módulo `whatsapp` (Meta Cloud API): requiere plantillas aprobadas y tiene
  costo por conversación.
- SMS: al final o fuera (costo y proveedor extra; WhatsApp cubre casi todo en Chile).
- **Patrón outbox** con worker y reintentos por canal; preferencias por usuario/canal y
  resumen diario opcional.

### Búsqueda por comuna

`Iglesia.comuna` hoy es texto libre: normalizar contra el catálogo oficial de comunas (código
CUT). Match por comuna, luego por región; "comunas vecinas" con coordenadas (PostGIS) más
adelante.

### Fases

1. **MVP:** registro autoservicio + verificación, perfil público opt-in, directorio por
   comuna, convocatorias por comuna, "¡Yo te ayudo!", notificaciones in-app + correo. (La
   "amistad" no hace falta para el MVP: la comuna hace el match.)
2. **Fase 2:** alianzas, convocatorias solo para aliadas, WhatsApp.
3. **Fase 3:** voluntarios individuales (un `Integrante` se ofrece directamente), mapa, SMS si
   se justifica.

### Decisiones abiertas

- ¿Una iglesia gratuita puede invitar a su equipo? (propuesta: 1 o 2 usuarios).
- ¿La mora baja al plan gratuito en vez de bloquear el login?
- ¿Las donaciones en dinero pasan por la plataforma o solo se muestran los datos de
  transferencia de la iglesia? (recomendado: lo segundo para empezar; lo primero implica
  pasarela de pago, temas tributarios y responsabilidad legal).
- ¿Quién recibe las alertas de convocatorias: solo el equipo de la iglesia o también los
  congregantes? (cambia volumen y costo de WhatsApp).

---

## Hechas

_(ninguna todavía)_
