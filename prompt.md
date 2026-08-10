# Brief para frontend: fecha de adquisición del plan, historial de pagos, confirmación de cambio de facturación y alertas de vencimiento (Fase 4 de docs/supabase.md)

## Resumen

Esta vez sí hay trabajo real para el frontend, en 4 frentes independientes:

1. **Rompe el formulario de alta de iglesia** — cambió un nombre de campo (obligatorio arreglar).
2. **Rompe (agrega un requisito a) el cambio de fecha de facturación** — ahora exige contraseña (obligatorio arreglar).
3. **Historial de pagos** — pantalla/sección nueva a construir (no existía antes).
4. **Alertas de vencimiento** (modal a 3 días + aviso mientras está vencida) — a construir desde cero, con toda la data que necesitan ya disponible en un endpoint que ya existe.

No pude tocar nada de esto yo mismo: solo tengo acceso a `frontend/src/app/agenda/asistencia` de su repo, el resto de esto vive en las pantallas de SuperAdmin y en el layout autenticado del lado de la iglesia — les dejo el contrato completo y una propuesta de UX para cada punto.

---

## 1. Alta de iglesia (SuperAdmin): `proximaFacturacion` → `fechaAdquisicionPlan`

**Antes** el SuperAdmin elegía a mano la fecha de la primera facturación. **Ahora** elige la fecha en que la iglesia adquirió el plan, y el backend calcula solo la primera facturación (+30 días).

`POST /iglesias` — body cambia:
```diff
- proximaFacturacion: "2026-09-05"
+ fechaAdquisicionPlan: "2026-08-10"
```

La respuesta sigue trayendo `iglesia.proximaFacturacion` ya calculada — si quieren mostrarle al SuperAdmin una preview de "próxima facturación: DD/MM" antes de enviar el formulario, pueden calcularlo ustedes mismos en el cliente (`fechaAdquisicionPlan + 30 días`) o simplemente mostrar el valor que vuelve en la respuesta después de crear.

Nada más cambia en ese formulario (resto de los campos, subida de logo, etc. igual que siempre).

---

## 2. Cambiar fecha de facturación: ahora exige contraseña

`PATCH /iglesias/:id/facturacion` — body cambia:
```diff
{
  "proximaFacturacion": "2026-09-15",
+ "password": "la-contraseña-del-superadmin-logueado"
}
```

Es el mismo patrón que ya deben tener implementado para borrar certificados de ceremonias (`ConfirmPasswordDto`) — si ya tienen un componente de "modal, pide tu contraseña para confirmar", es reutilizable acá tal cual.

**Respuestas de error a manejar:**
- Falta el campo o viene vacío → `400`, `{ "message": ["password should not be empty", ...] }`.
- Contraseña incorrecta → `401`, `{ "message": "Contraseña incorrecta" }`.
- Contraseña correcta → `200` con la iglesia actualizada, igual que antes.

Recomendación de copy para el modal: algo como *"Vas a cambiar la fecha de facturación de {iglesia} al {nueva fecha}. Ingresa tu contraseña para confirmar."* — no es una acción destructiva, pero sí afecta cuándo se corta el acceso de una iglesia por mora, así que vale la pena que el modal lo explique.

---

## 3. Historial de pagos (pantalla nueva)

`GET /iglesias/:id/historial-pagos` (SuperAdmin) — nuevo endpoint. Devuelve un array, más reciente primero:

```json
[
  {
    "id": "cmsm...",
    "fecha": "2026-08-10T04:35:10.280Z",
    "createdAt": "2026-08-10T04:35:10.284Z",
    "registradoPor": { "id": "cmrh...", "nombre": "Admin", "apellido": "Plataforma" }
  },
  {
    "id": "cmsm...",
    "fecha": "2026-08-10T00:00:00.000Z",
    "createdAt": "2026-08-10T04:34:38.690Z",
    "registradoPor": { "id": "cmrh...", "nombre": "Admin", "apellido": "Plataforma" }
  }
]
```

- El **primer registro** (más viejo, al final del array) siempre es la fecha de adquisición del plan.
- Los siguientes son cada `marcarPagada` (confirmación manual de pago) que se haya hecho.
- `registradoPor` puede venir `null` si esa cuenta de SuperAdmin ya no existe.
- No hay monto — el modelo de precios todavía no está definido (ver `CLAUDE.md`), así que no hay un `$` que mostrar todavía. Cuando se defina, este es el lugar natural para agregarlo.

Propuesta de UX: una tabla simple dentro del detalle de la iglesia (donde ya está el semáforo de facturación) — fecha, quién lo registró, nada más por ahora.

---

## 4. Alertas de vencimiento (lado iglesia — Manager)

Esto es lo más grande y donde más autonomía de diseño tienen ustedes: la regla de negocio es "avisar 7 días antes por correo (ya lo hace el backend automáticamente, no requiere nada de ustedes), mostrar un modal a los 3 días, y mantener alguna alerta visible mientras esté vencida".

**No hay endpoint nuevo para esto.** `GET /mi-iglesia/facturacion` (que ya deberían estar consumiendo desde el módulo de Facturación que se construyó en agosto) ya trae absolutamente todo lo necesario:

```json
{
  "...": "...datos de la iglesia...",
  "plan": "BASICO",
  "facturacion": {
    "proximaFacturacion": "2026-08-13T00:00:00.000Z",
    "diasParaFacturacion": 3,
    "color": "ROJO",
    "enMora": false,
    "diasEnMora": 0,
    "puedeOcultar": false
  },
  "limites": { "...": "..." }
}
```

- `diasParaFacturacion`: positivo = faltan días; `0` = vence hoy; negativo = días vencida (o usar `diasEnMora`, que ya viene positivo).
- `color`: `VERDE` / `AMARILLO` (≤7 días) / `ROJO` (≤2 días o vencida) — el semáforo ya existe y probablemente ya lo estén pintando en algún lado del dashboard.
- `enMora`: booleano, vencida o no.

**Propuesta concreta (ajústenla a su criterio de UX, esto es solo un punto de partida):**

- **Modal** ("de buena manera", no agresivo): mostrar cuando `facturacion.diasParaFacturacion` está entre `0` y `3` (inclusive) y `enMora` es `false`. Sugerencia: que se pueda cerrar ("Entendido") pero vuelva a aparecer la próxima vez que abran la app (no marcar como "visto para siempre" en localStorage) — la fecha real no cambió, así que el recordatorio sigue siendo válido al día siguiente si no se resolvió.
  - Copy sugerido: *"Tu próxima facturación es el {fecha}. Para que tu equipo no pierda acceso, recuerda ponerte al día a tiempo."* — con `diasParaFacturacion === 0` cambiar a *"Tu facturación vence hoy."*
- **Aviso persistente** (banner, no modal — menos intrusivo para algo que puede durar días): mostrar mientras `enMora === true`. Copy sugerido: *"Tu facturación venció hace {diasEnMora} día(s). Ponte al día para evitar que se suspenda el acceso de tu equipo."* — reforzando el mismo mensaje que ya les llega por correo cada 2 días.
- Ambos son exclusivamos entre sí en la práctica (antes de vencer vs. ya vencida), así que no debería haber conflicto de cuál mostrar.

**Los correos ya los manda el backend solo, automáticamente** (recordatorio 7 días antes, y aviso cada 2 días mientras esté vencida) — no hay nada que integrar ahí, es informativo por si quieren que el copy del modal/banner sea consistente con el del correo.

---

## Resumen de lo que NO cambió

- El resto de los campos/endpoints de iglesias (plan, ocultar/mostrar, etc.) — sin cambios.
- `GET /iglesias/:id` (detalle SuperAdmin) — mismo shape que siempre, no incluye el historial (usen el endpoint nuevo aparte).
- Cualquier otro módulo (agenda, finanzas, ceremonias, integrantes) — sin cambios.
