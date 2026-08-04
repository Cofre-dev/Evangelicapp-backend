# Brief para Frontend — Planes comerciales (Básico/Medio/Pro) + Facturación

El backend ya implementa planes comerciales, fecha de facturación y el bloqueo de
acceso por mora. Este documento es la especificación completa para construir la
parte de frontend (repo separado). Está escrito para poder implementarse sin tener
que leer el código del backend, pero si algo no calza, la fuente de verdad son los
archivos citados entre paréntesis.

## Resumen de negocio (contexto)

3 planes, estrategia tipo "bencina 93/95/97" — siempre empujar al más caro:

| Plan | Máx. usuarios (incl. manager) | Subdepartamentos de finanzas |
|---|---|---|
| Básico | 3 | Sin acceso |
| Medio | 8 | Sin acceso |
| Pro | 15 | Hasta 10 |

Toda iglesia nueva **debe** tener un plan y una fecha de facturación asignados por
el SuperAdmin al crearse — no hay un plan por defecto. Cambiar de plan después
nunca borra ni desactiva datos existentes, solo cambia los topes hacia delante.

No hay pasarela de pago todavía: los pagos se confirman **manualmente** por el
SuperAdmin. El módulo de facturación del lado de la iglesia es solo informativo.

## 1. Tipos nuevos

```ts
type PlanIglesia = "BASICO" | "MEDIO" | "PRO";

// EstadoIglesia ya existía (ver stores/auth-store.ts y las páginas de superadmin);
// SUSPENDIDA ahora tiene un significado operativo concreto: iglesia oculta por mora.
type EstadoIglesia = "ACTIVA" | "SUSPENDIDA" | "INACTIVA";

interface EstadoFacturacion {
  proximaFacturacion: string; // ISO date
  diasParaFacturacion: number; // negativo si ya venció
  color: "VERDE" | "AMARILLO" | "ROJO";
  enMora: boolean;
  diasEnMora: number; // 0 si no está en mora
  puedeOcultar: boolean; // true con 3+ días de mora — habilita el botón "ocultar iglesia"
}
```

**Semáforo** (`backend/src/common/utils/calcular-facturacion.ts`): verde es todo lo
que no es amarillo ni rojo (>7 días para la fecha de pago), amarillo arranca a los
7 días, rojo arranca a los 2 días y se mantiene rojo mientras esté vencida (sumando
`enMora`/`diasEnMora`). No recalcules esto en el frontend — el backend siempre
manda `facturacion` ya calculado; solo hay que pintarlo.

Colores sugeridos (Tailwind, ajustar a la paleta real del design system):
- `VERDE` → verde éxito (ej. `bg-emerald-100 text-emerald-700`)
- `AMARILLO` → amarillo advertencia (ej. `bg-amber-100 text-amber-700`)
- `ROJO` → rojo destructivo (ej. `bg-destructive/10 text-destructive`, ya usado en `Alert variant="destructive"`)

## 2. Alta de iglesia (SuperAdmin) — `CreateIglesiaDialog`

Archivo: `src/components/iglesias/create-iglesia-dialog.tsx`.

Agregar al `createIglesiaSchema` (línea 30) y a los `defaultValues` (línea 83):

```ts
plan: z.enum(["BASICO", "MEDIO", "PRO"], { required_error: "Selecciona un plan" }),
proximaFacturacion: z.string().min(1, "Selecciona la fecha de facturación"),
```

En el paso 1 del formulario (junto a región/comuna, antes del botón "Siguiente" en
la línea ~327), agregar:
- Un `Select` de plan con las 3 opciones (Básico / Medio / Pro). Considera mostrar
  los topes de cada uno en el mismo selector (ej. "Pro — hasta 15 usuarios, 10
  subdepartamentos") para que el SuperAdmin no tenga que adivinar.
- Un date picker para `proximaFacturacion` (primera fecha de cobro acordada).

En `onSubmit` (línea 137), agregar al `FormData`:
```ts
formData.append("plan", values.plan);
formData.append("proximaFacturacion", values.proximaFacturacion); // "YYYY-MM-DD"
```

El resto del flujo (multipart, `POST /iglesias`) no cambia.

## 3. Detalle de iglesia (SuperAdmin) — `/superadmin/iglesias/[id]`

Archivo: `src/app/superadmin/iglesias/[id]/page.tsx`. El endpoint `GET /iglesias/:id`
ahora devuelve, además de lo que ya se consume (`pastor`, `equipo`, `estado`, etc.):

```json
{
  "id": "...",
  "nombre": "...",
  "estado": "ACTIVA",
  "ultimoPagoAt": "2026-07-05T00:00:00.000Z",
  "plan": "PRO",
  "pastor": { "...": "..." },
  "equipo": ["..."],
  "facturacion": {
    "proximaFacturacion": "2026-08-20T00:00:00.000Z",
    "diasParaFacturacion": 17,
    "color": "VERDE",
    "enMora": false,
    "diasEnMora": 0,
    "puedeOcultar": false
  },
  "limites": {
    "usuarios": { "actuales": 4, "maximo": 15 },
    "departamentosFinancieros": { "actuales": 2, "maximo": 10 }
  }
}
```

Nota: **no** hay un `proximaFacturacion` a nivel raíz — vive dentro de `facturacion`.
`ultimoPagoAt` puede ser `null` (nunca se ha marcado un pago).

Agregar a esta pantalla:

1. **Badge de plan** junto al badge de estado que ya existe (línea ~144-153).
2. **Tarjeta de facturación**: fecha de próxima facturación con el badge de color
   (`facturacion.color`), y si `enMora` es `true`, un texto tipo "Vencida hace {N}
   días". Si `diasParaFacturacion >= 0`, mostrar "Faltan {N} días".
3. **Acciones de SuperAdmin** (todas mutan y deberían refrescar la página con la
   respuesta del propio endpoint, que ya viene con el shape completo de arriba):
   - **Cambiar plan**: `PATCH /iglesias/:id/plan` con body `{ "plan": "MEDIO" }`.
   - **Editar fecha de facturación** (corrección manual, ej. error de tipeo):
     `PATCH /iglesias/:id/facturacion` con body `{ "proximaFacturacion": "2026-09-05" }`.
   - **Marcar como pagada**: `POST /iglesias/:id/marcar-pagada` (sin body). Avanza
     la fecha un mes y reactiva la iglesia si estaba oculta. Usar como el botón
     principal de "confirmar pago" — es el único mecanismo de pago que existe hoy.
   - **Ocultar iglesia**: `PATCH /iglesias/:id/ocultar` (sin body). Es el checkbox/
     botón que pediste que solo esté disponible cuando `facturacion.puedeOcultar
     === true` (3+ días de mora) — deshabilítalo si es `false`, con un tooltip tipo
     "Disponible cuando la mora supere los 3 días". El backend también lo valida
     server-side, así que un intento fuera de esa ventana responde 403 igual.
   - **Mostrar iglesia**: `PATCH /iglesias/:id/mostrar` (sin body). Siempre
     disponible — para deshacer un "ocultar" hecho por error, sin tener que pasar
     por "marcar pagada".
   - Uso actual vs. plan (`limites`): una barra o texto simple tipo "4 / 15 usuarios",
     "2 / 10 subdepartamentos" — útil para que el SuperAdmin sepa si vale la pena
     ofrecerle un upgrade a esa iglesia.

## 4. Dashboard SuperAdmin — columna de plan

Archivo: `src/app/superadmin/page.tsx`. `GET /superadmin/dashboard` ahora incluye
`plan` en cada fila de `iglesias` (mismo nivel que `estado`). Agregar una columna
"Plan" a la tabla (línea ~183), con el mismo tipo de badge que el de `estado`.

## 5. Sesión y plan visible en toda la app

Archivo: `src/stores/auth-store.ts`. El campo `iglesia` dentro de `SessionUser`
(línea 16) ahora trae `plan` también:

```ts
iglesia: { nombre: string; logoUrl: string | null; plan: "BASICO" | "MEDIO" | "PRO" } | null;
```

Esto viene poblado en **toda** sesión (`/auth/login` y `/auth/me`), para cualquier
rol de la iglesia (MANAGER y USUARIO), no solo el manager. Úsalo para mostrar un
badge de plan visible en el shell de la app (navbar/sidebar) — es el pedido de
"que se vea reflejado qué plan tienen". `SUPER_ADMIN` no tiene `iglesia` (sigue
siendo `null`, sin cambios).

## 6. Bloqueo de acceso por mora (lado iglesia)

Cuando una iglesia queda oculta (`estado = SUSPENDIDA`, ver sección SuperAdmin),
**ningún** usuario de esa iglesia puede loguearse ni mantener una sesión activa —
esto se revalida en cada request, igual que ya se hace con `usuario.activo`.

Ambos casos (login bloqueado y sesión cortada a mitad de camino) usan la **misma
forma de error**, un 403 con este body:

```json
{
  "statusCode": 403,
  "code": "IGLESIA_SUSPENDIDA",
  "message": "La iglesia tiene la mensualidad pendiente de pago.",
  "diasEnMora": 5
}
```

Cambios necesarios en `src/lib/api.ts`:

1. En `POST /auth/login` (`src/app/login/page.tsx`, función `onSubmit`, línea 60):
   si el catch recibe un `ApiError` con `error.body?.code === "IGLESIA_SUSPENDIDA"`,
   en vez de mostrar `serverError` normal, redirigir a una página nueva
   `/cuenta-suspendida?dias=<diasEnMora>` (ver punto 3 abajo) en lugar de quedarse
   en el login.
2. En `apiFetch` (`src/lib/api.ts`, alrededor de la línea 127, donde ya se maneja
   `res.status === 401`): agregar el mismo tratamiento para `res.status === 403`
   **cuando** `body?.code === "IGLESIA_SUSPENDIDA"` — limpiar la sesión
   (`clearSession()`) y redirigir a `/cuenta-suspendida?dias=<diasEnMora>`. Esto
   cubre el caso de una sesión que ya estaba abierta cuando el SuperAdmin oculta la
   iglesia: la próxima llamada a la API (cualquiera) la corta.
3. **Página `/cuenta-suspendida`** (nueva, pública, sin `useRequireAuth`): el texto
   pedido es algo como "No han pagado la mensualidad, pónganse al día" + un
   contador de días en mora usando el query param `dias`. Sugerido: "Llevan {dias}
   días de atraso en el pago de tu mensualidad." + un `mailto:contacto@evangelic.app`
   como salida. No necesita datos de la iglesia (el mensaje es genérico), así que no
   hace falta ninguna llamada a la API en esta pantalla.

## 7. Módulo de Facturación (lado iglesia) — nueva página `/facturacion`

Solo MANAGER (mismo alcance que `/mi-iglesia`, ver `mi-iglesia.controller.ts`).
Nuevo endpoint: `GET /mi-iglesia/facturacion`:

```json
{
  "id": "...",
  "nombre": "...",
  "estado": "ACTIVA",
  "plan": "MEDIO",
  "facturacion": {
    "proximaFacturacion": "2026-08-10T00:00:00.000Z",
    "diasParaFacturacion": 7,
    "color": "AMARILLO",
    "enMora": false,
    "diasEnMora": 0,
    "puedeOcultar": false
  },
  "limites": {
    "usuarios": { "actuales": 5, "maximo": 8 },
    "departamentosFinancieros": { "actuales": 0, "maximo": 0 }
  }
}
```

Contenido de la página (todo informativo, sin acciones — no hay pasarela de pago):

- Plan actual, con los topes (usuarios y subdepartamentos) y el uso actual
  (`limites`).
- Fecha de próxima facturación con el badge de color de `facturacion.color`.
- Texto fijo: *"Si ya pagaste tu mensualidad, pero te aparece que no, manda un
  correo a contacto@evangelic.app con el asunto 'Confirmación de pago —
  {nombre de la iglesia}'."*
- Texto fijo: *"Si quieres subir de plan, manda un correo a contacto@evangelic.app
  con el asunto 'Solicitud de upgrade de plan — {nombre de la iglesia}'."*
  (Los asuntos entre comillas son una propuesta mía — confírmalos con el fundador
  antes de darlos por definitivos, el pedido original los dejó sin especificar.)

**Aviso en el dashboard principal**: cuando `facturacion.color` sea `AMARILLO` **o**
`ROJO` (rojo es más urgente que amarillo, así que debería incluirse también aunque
el pedido original solo mencionó amarillo), mostrar un banner/alert en el dashboard
de inicio de la iglesia (MANAGER y USUARIO) del tipo "Tu próxima facturación es en
{N} días — revisa el módulo de Facturación", con link a `/facturacion`. Esto implica
llamar `GET /mi-iglesia/facturacion` desde el dashboard, o exponer ese dato en un
layout compartido si ya existe uno para el shell de la app.

## 8. Límite de usuarios por plan

Al crear un usuario (`POST /usuarios`, formulario en `src/app/equipo/` o donde
viva hoy la gestión de equipo), si el plan ya está al tope, el backend responde
403:

```json
{
  "statusCode": 403,
  "code": "PLAN_LIMITE_USUARIOS",
  "message": "Tu plan Básico solo permite 3 usuarios (incluyendo al manager). Habla con contacto@evangelic.app para subir de plan.",
  "plan": "BASICO",
  "maximo": 3
}
```

Cuando el catch del formulario de creación reciba `error.body?.code ===
"PLAN_LIMITE_USUARIOS"`, mostrar un modal (no solo el error inline de siempre) con
el `message` tal cual viene del backend (ya incluye el contacto y el número
correcto para el plan que sea). Después de mostrarlo, deshabilitar el botón de
"crear usuario" en esa sesión de la página — no hace falta que sea permanente ni
reactivo a otros cambios, con que no deje seguir insistiendo en la misma pantalla
basta. La forma más simple: guardar un estado `limiteAlcanzado` en el componente y
condicionar el `disabled` del botón a eso.

Opcionalmente (no bloqueante): usar `limites.usuarios` de `GET /mi-iglesia` (si esa
pantalla ya lo consume) para deshabilitar el botón *antes* de intentarlo, evitando
el viaje redondo al backend.

## 9. Subdepartamentos de finanzas por plan

Al crear un departamento (`POST /finanzas/departamentos`, en `src/app/finanzas/departamentos/`):

- Planes **Básico/Medio**: el backend responde 403 con
  `code: "PLAN_SIN_SUBDEPARTAMENTOS"`. Como el pedido original es "sin acceso" (no
  solo un límite), la recomendación es **ocultar directamente** la entrada de menú
  o el botón "Crear departamento" para estos dos planes (usar
  `usuario.iglesia.plan` de la sesión, ver sección 5) en vez de dejar que el
  usuario llegue al 403. Si de todos modos llega (ej. otra pestaña con un plan
  viejo cacheado), mostrar `error.body.message` en un alert simple — no hace falta
  modal, a diferencia del caso de usuarios.
- Plan **Pro** al tope de 10: `code: "PLAN_LIMITE_DEPARTAMENTOS"`, mismo
  tratamito de alert simple con `error.body.message`.

## 10. Resumen de endpoints nuevos/modificados

| Método | Ruta | Rol | Cambio |
|---|---|---|---|
| `POST` | `/iglesias` | SUPER_ADMIN | Body ahora exige `plan` y `proximaFacturacion` |
| `GET` | `/iglesias/:id` | SUPER_ADMIN | Response ahora incluye `plan`, `facturacion`, `limites`, `ultimoPagoAt` |
| `PATCH` | `/iglesias/:id/plan` | SUPER_ADMIN | Nuevo — cambia el plan |
| `PATCH` | `/iglesias/:id/facturacion` | SUPER_ADMIN | Nuevo — corrige la fecha de facturación |
| `POST` | `/iglesias/:id/marcar-pagada` | SUPER_ADMIN | Nuevo — confirma pago, avanza 1 mes, reactiva si estaba oculta |
| `PATCH` | `/iglesias/:id/ocultar` | SUPER_ADMIN | Nuevo — oculta la iglesia (requiere 3+ días de mora) |
| `PATCH` | `/iglesias/:id/mostrar` | SUPER_ADMIN | Nuevo — reactiva la iglesia |
| `GET` | `/superadmin/dashboard` | SUPER_ADMIN | Cada iglesia de la lista ahora incluye `plan` |
| `GET` | `/mi-iglesia/facturacion` | MANAGER | Nuevo — módulo de facturación informativo |
| `POST` | `/auth/login` | — | Puede responder 403 `IGLESIA_SUSPENDIDA` |
| cualquier ruta autenticada | — | — | Puede responder 403 `IGLESIA_SUSPENDIDA` si la iglesia se ocultó a mitad de sesión |
| `POST` | `/usuarios` | MANAGER | Puede responder 403 `PLAN_LIMITE_USUARIOS` |
| `POST` | `/finanzas/departamentos` | MANAGER | Puede responder 403 `PLAN_SIN_SUBDEPARTAMENTOS` o `PLAN_LIMITE_DEPARTAMENTOS` |
| `GET`/`POST`/`PATCH` `/auth/*` | — | — | `SafeUsuario.iglesia` ahora incluye `plan` |

## Decisiones que tomé (a confirmar si algo no calza con lo que tenías en mente)

- **`EstadoIglesia.SUSPENDIDA`** (que ya existía en el schema, sin uso real hasta
  ahora) es el mecanismo que se reutilizó para "iglesia oculta por mora" — no se
  agregó un campo nuevo. Como efecto colateral (ya existía antes de este cambio),
  una iglesia oculta también deja de responder en el QR público de Integrantes.
- El semáforo usa el esquema "escalón simple" que confirmaste: verde >7 días,
  amarillo ≤7, rojo ≤2 o vencida.
- "Marcar como pagada" es la única forma de avance de fecha que existe (no hay
  pasarela) y siempre suma el mes sobre la fecha vencida anterior (nunca sobre
  "hoy"), para no correr el día de cobro acordado con la iglesia.
- Los asuntos de correo sugeridos en la sección 7 son una propuesta mía, no un
  requisito — confírmalos.
