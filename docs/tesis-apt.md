# Tesis / Proyecto APT 2026-2 — contexto para Claude

Este archivo es la memoria de trabajo de la **documentación de tesis (Proyecto APT)** de
EvangelicApp. Léelo completo antes de trabajar en cualquier documento de la carpeta
`C:\Users\rojas\Desktop\entregables`, y actualízalo cada vez que avance la documentación.

## Situación en una línea

El autor programa el proyecto **solo**, pero en la documentación **cada rol de Scrum es una persona
distinta** (decisión del 08-10, por observación de la docente): **Persona 1 = Product Owner**,
**Persona 2 = Scrum Master** y **Matías Cofré = Developer** (único developer, ~30 h por semana).
Los nombres de Persona 1 y 2 se completan cuando el autor los defina.
**El software ya está terminado**: todo lo real está en `FEATURES.md` y en el historial de git, y
llega hasta el 10-09-2026. **Ahora escribe la documentación Scrum** siguiendo la Carta Gantt, como
si EvangelicApp se hubiera construido sprint a sprint hasta terminar en el último sprint (Sprint 5, S14).

## Reglas de trabajo

- **Jornada:** lunes a viernes, **30 h por semana**. Un sprint dura 2 semanas, unas 60 h, y se
  descuentan los feriados (por ejemplo, el 18-09 de Fiestas Patrias).
- **Al empezar cada sesión:** compara la fecha de hoy con el calendario de abajo, revisa hasta
  qué fecha está al día cada documento (tabla de encabezado → `Fecha` y `Versión`) y avanza
  solo lo que corresponde **hasta el último día hábil ya transcurrido**. No documentes días
  futuros.
- **Antes de hacer algo, explica qué vas a hacer y espera confirmación** (pedido explícito del
  autor).
- **No modificar código** del backend como parte de la documentación, salvo que el autor lo pida.
- **Respaldo:** antes de editar un `.docx` o `.xlsx` de `entregables`, copia el archivo a
  `entregables/_respaldos/AAAA-MM-DD/`. El respaldo del 2026-09-26 guarda el estado **anterior**
  a la re-planificación (sprints de Docker, pruebas, pasarela, ZAP y piloto).
- **Contenido de las Daily y de los sprints:** sale de las entradas de `FEATURES.md` según el
  mapeo de abajo. No se inventan features; las tareas y los impedimentos se derivan de lo que
  cuenta cada entrada (decisiones, bugs y bloqueos reales).
- **Coherencia:** la Daily, el Sprint Backlog, el Scrumboard, el Burndown y el Registro de
  Impedimentos deben coincidir en tareas, horas y fechas. Las horas del burndown son las horas
  restantes estimadas al cierre de cada día.

## Calendario (Carta Gantt — `entregables/Carta gantt.png`, “Figura 8”)

Semestre del 10-08-2026 al 11-12-2026. Cada semana parte el lunes.

| Semana | Lunes | Fase | Actividad | Hito |
|---|---|---|---|---|
| S1 | 10-08 | Definición | Definición del proyecto APT | |
| S2 | 17-08 | Definición | Definición del proyecto APT | |
| S3 | 24-08 | Definición | Definición + Product Vision y Backlog | |
| S4 | 31-08 | Definición | Vision y Backlog + Documento de diseño | **Evaluación Fase 1 (20%)**, entregada el 04-09 |
| S5 | 07-09 | Desarrollo | **Sprint 1: Facturación, dashboards y tiempo real** + Doc. diseño | |
| S6 | 14-09 | Desarrollo | Sprint 1 (18-09 feriado) + Doc. diseño | |
| S7 | 21-09 | Desarrollo | **Sprint 2: Supabase Auth y WhatsApp** | |
| S8 | 28-09 | Desarrollo | Sprint 2 (cierre el 02-10: Release v1.2.0, Review y Retro) | |
| S9 | 05-10 | Desarrollo | **Sprint 3: RLS multi-tenant y staging** | |
| S10 | 12-10 | Desarrollo | Sprint 3 (cierre el 16-10, v1.3.0) | **Informe de avance (20%)** |
| S11 | 19-10 | Desarrollo | **Sprint 4: QA de seguridad, k6 y Realtime** | |
| S12 | 26-10 | Desarrollo | Sprint 4 (cierre el 30-10, v1.4.0) + Documentación e informe final | |
| S13 | 02-11 | Desarrollo | **Sprint 5: Correo, convocatorias y producción** + informe final | |
| S14 | 09-11 | Desarrollo | Sprint 5 (cierre el 13-11, **v2.0.0**) + informe final | |
| S15 | 16-11 | Desarrollo | Documentación e informe final; Retrospectiva del proyecto | **Informe final (30%)** |
| S16 | 23-11 | Presentación | Presentación a comisión | |
| S17 | 30-11 | Presentación | Presentación a comisión | **Defensa ante comisión (30%)** |
| S18 | 07-12 | Presentación | Presentación a comisión | |

## Re-planificación del 26-09-2026 (decisión del autor)

La Gantt original prometía cosas que **no existen en el código** (pruebas con ≥ 70% de cobertura,
pasarela de pago en sandbox, reporte OWASP ZAP y piloto con una iglesia real). Como el producto
ya está terminado, se re-planificó **toda** la documentación (incluida la Fase 1 ya evaluada)
para que los sprints sean exactamente las features reales de `FEATURES.md`, en orden cronológico,
terminando en el Sprint 5:

- **Fase 1 (S1–S4):** las Daily #01–#20 quedaron **solo con trabajo de definición**. Ya no mencionan features.
- **Incremento base (Release 1.0):** todo lo de `FEATURES.md` anterior al 10-08 (commit inicial,
  CI, MySQL → PostgreSQL, planes y bloqueo por mora, Supabase, Storage, resize, caché de PDFs).
- **Fuera del alcance del semestre:** pasarela de pago (no hay modelo de negocio definido),
  Dockerfile del backend, pruebas unitarias con umbral de cobertura, OWASP ZAP y piloto.
- **NO se documentan en la tesis (decisión del autor, 26-11-2026):** el reporte financiero a la
  congregación y la red de alianzas entre iglesias (`docs/pendientes-producto.md`). No van en
  Daily, backlog, sprints, informe ni presentación. Se documentarán después, cuando el autor lo pida.
- Cambiaron: la Gantt, DOC-01, 02, 04 (figura), 05, 06, 07, 08 (figura), 09, 10 (figura),
  11 (figura + nota de “arquitectura objetivo”), DOC-12 (las 34 Daily), los 8 documentos del
  Sprint 1, los 5 del Sprint 2 y la planilla. DOC-03 (Mapa Mental) no cambió.
- Las carpetas se renombraron: `2. Sprint 1 - Facturación, dashboards y tiempo real (S5-S6)` y
  `3. Sprint 2 - Supabase Auth y WhatsApp (S7-S8)`.

## Sprints y mapeo FEATURES.md → sprint

32 HU · 187 pts (base 63 + alcance APT 124). 9 épicas: EP-01 Iglesias y equipo, EP-02 Agenda y
convocatorias, EP-03 Finanzas, EP-04 Notas, EP-05 Membresía y ceremonias, EP-06 Operación y
facturación, EP-07 Seguridad, EP-08 Calidad e infraestructura, EP-09 Tiempo real.

| Sprint | Fechas | HU (pts) | Entradas de `FEATURES.md` que cubre |
|---|---|---|---|
| Base | antes del 10-08 | HU-01, 02, 03, 04, 08, 09, 10, 11, 13, 14 (63) | 07-08 → 09-08 |
| **1** | 07-09 → 17-09 | HU-16, 15, 30, 23, 26 (26) · 56 h · T1.1–T1.14 | 10-08 Fase 4 (recordatorios, historial de pagos) · 11-08 KPIs + página Iglesias + heartbeat · 12-08 brief de notas y alerta · 13-08 Realtime con WebSocket propio |
| **2** | 21-09 → 02-10 | HU-17 (13), HU-31 (5), HU-05 (8) · 55 h · T2.1–T2.14 | 14-08 Fase 7 (base, pasos 3 a 8) · 15-08 WhatsApp, supabase-todo y corte del login · 16-08 DATABASE_URL e identidad, fix de confirmación de contraseña, sincronización de docs · 19-08 commit |
| **3** | 05-10 → 16-10 | HU-18 (13), HU-12 (5), HU-27 (8) | 20-08 Fase 8 RLS · 21-08 eliminar MIEMBRO + consentimiento Ley 21.719 · 21-08 fix `$use` → `$extends` · 25-08 staging (Supabase + Render) · 26-08 CORS + bug de RLS de módulos de USUARIO |
| **4** | 19-10 → 30-10 | HU-21 (8), HU-29 (5), HU-32 (5), HU-24 (5) | 27-08 QA ronda 2 (k6, SQLi, límites, refresh token) y ronda 3 (bug de RLS en realtime) · 07-09 Broadcast en parallel-run · 08-09 policy RLS en realtime + smoke test |
| **5** | 02-11 → 13-11 | HU-19, 07, 28, 06, 20, 22, 25 (23) | 08-09 Resend + asistencia en vivo + plantilla de predicador + recuperar contraseña · diagnóstico CSRF · estado de convocatoria + rate limit · 09-09 verificación de RLS, consolidación en main, 6543, RLS en `_prisma_migrations`, docker-compose · 10-09 dominio propio → **v2.0.0** |

Numeración de impedimentos: Sprint 1 IMP-01 a IMP-06; Sprint 2 IMP-07 a IMP-10 (IMP-09 quedó
"Escalado al Product Backlog" con HU-05); Sprint 3 IMP-11 a IMP-15 (IMP-15 escalado al Product Backlog → HU-25); Sprint 4 IMP-16 e IMP-17 (IMP-16 sigue abierto; IMP-17 escalado al Product Backlog); Sprint 5 IMP-18 a IMP-20 (IMP-15 del Sprint 3 se cerró en el Sprint 5 con el dominio propio). Total del proyecto: 20.

### Sprint 2 — cerrado el 02-10 (v1.0 / v1.3)

Velocidad 18/26 (HU-17 y HU-31 aceptadas; **HU-05 no aceptada**, vuelve al Product Backlog sin sprint,
porque WhatsApp nunca tuvo envío real; DOC-07, 08 y 10 la siguen mostrando en el Sprint 2 porque son la
planificación original). Horas 55/54: la hora de T2.8 vuelve con HU-05. Burndown final 55 → … → 6 → 1.
Release v1.2.0, Review y Retro en v1.0 (`sprint2_cierre.py`; el 01-10 fueron borrador v0.9).
Acciones de la Retro para el Sprint 3: no comprometer historias con aprobaciones externas, proyecto de
Supabase dedicado para staging, docs dentro de cada tarea y RLS probado primero en desarrollo.

### Sprint 3 — cerrado el 16-10 (v1.3.0)

Velocidad **21/26**: HU-18 y HU-27 aceptadas; **HU-12 no aceptada** (decisión del autor del 25-10, igual
criterio que HU-05): cumple los criterios 1 y 3 pero no el 2 (el backend no guarda fecha ni versión del
consentimiento; el QA del Sprint 4 lo confirma). Vuelve al Product Backlog **sin sprint**. Horas 55/55. Burndown
final 55 → 53 → 46 → 38 → 33 → 28 → 23 → 18 → 13 → 5 → 0. S3-02 a S3-05 en v1.2; Release v1.3.0, Review y Retro en
v1.0 (`sprint3_cierre.py`, copiados de los del Sprint 2). Product Backlog v1.5 (16-10). Acciones de la Retro para
el Sprint 4: revisar los criterios de la HU al cerrar cada tarea, QA con cada rol y verificado en la base, registrar
las migraciones a mano el mismo día y checklist de despliegue antes del deploy de Realtime.

### Sprint 4 — cerrado el 30-10 (v1.4.0)

Velocidad **15/23**: HU-29, HU-32 y HU-24 aceptadas; **HU-21 no aceptada** (decisión del autor del 11-11, mismo
criterio que HU-05 y HU-12): cumple los criterios 1 y 3 pero no el 2 (quedan vulnerabilidades altas en runtime,
IMP-17). Vuelve al Product Backlog **sin sprint**. Horas 55/55. Burndown final 55 → 53 → 47 → 40 → 33 → 26 → 21 → 15 →
10 → 4 → 0. S4-02 a S4-05 en v1.2 (`sprint4.py`); Release v1.4.0, Review y Retro en v1.0 (`sprint4_cierre.py`). Product
Backlog v1.7 (30-10). Socket.io **sigue** en parallel-run (en el código real nunca se borró): el PR de limpieza queda como
deuda técnica, no se promete en el Sprint 5. Acciones de la Retro para el Sprint 5: revisar en la Planning que cada
criterio se pueda cumplir dentro del sprint, smoke test el mismo día de cada cambio desplegado, migraciones primero en
una base local descartable (HU-22) y anotar en la Daily cada configuración de infraestructura que dependa del PO.

### Sprint 5 — cerrado el 13-11 (v2.0.0)

Carpeta `7. Sprint 5 - Correo, convocatorias y producción (S13-S14)`. HU-19 (5), HU-07 (3), HU-28 (2), HU-06 (5), HU-20
(2), HU-22 (3), HU-25 (3) = 23 pts, 55 h, T5.1–T5.16. Velocidad **23/23** (decisión del autor del 23-11: se aceptan las 7).
Horas 55/55. Burndown final 55 → 53 → 47 → 41 → 35 → 30 → 24 → 18 → 12 → 5 → 0. S5-02 a S5-05 en v1.2 (`sprint5.py`);
Release v2.0.0, Review y Retro en v1.0 (`sprint5_cierre.py`). Product Backlog **v1.9** (13-11): 29 de 32 HU, 166 de 187 pts;
HU-05, HU-12 y HU-21 sin sprint. Impedimentos: IMP-18 e IMP-20 resueltos, IMP-19 mitigado, IMP-15 resuelto (dominio
propio), IMP-16 abierto, IMP-14 e IMP-06 mitigados. Deuda técnica del release: `NEXT_PUBLIC_API_URL` del frontend,
`prisma migrate resolve` de `20260909223000`, DROP de `refresh_tokens`, retiro de socket.io y disparo manual del cron.
T5.16 no tocó la Guía 3 (decisión del 11-11); la Guía 3 se completó después, en la S15.

### Cierre del proyecto (S15, 16-11 → 20-11) y Presentación (S16 →)

Sin sprint. Daily #70 a #74 con fase "Desarrollo · Cierre del proyecto (sin sprint)": informe final (desarrollo,
evidencias, resultados, conclusiones) y Retrospectiva del proyecto. Daily #75 (lun 23-11, fase "Presentación ·
Preparación de la defensa"; se documentó el mismo día, a pedido explícito del autor).

- `8. Cierre del proyecto (S15)/C-01 - Retrospectiva del proyecto.docx` (18-11, v1.0, `cierre_proyecto.py`): resultados
  por sprint (103/124 pts del alcance APT, 83%; 275/276 h; velocidad promedio 20,6), gráfico de velocidad, Start / Stop /
  Continue, 4 acciones para el siguiente ciclo y 8 pendientes de deuda técnica.
- Guía 3 (`Fase 2/Evidencias Grupales/2.6_…Informe Final…docx`): secciones 4 (Desarrollo), 5 (Evidencias) y 6 (Intereses,
  sigue marcada "Borrador" porque es personal) completadas al 20-11 con `informe_final.py`. Siguen pendientes del autor:
  portada, índice, numeración, anexo de capturas y referencias APA.
- `EvangelicApp - Presentación final (23-11-2026).pptx` (21 diapositivas) para la defensa: `presentacion/build_final.js`
  (derivado de `build.js`). Para regenerarlo: `npm i pptxgenjs@3.12.0 react@18.3.1 react-dom@18.3.1 react-icons@5.3.0
  sharp@0.33.5 jszip@3.10.1` en una carpeta temporal y `NODE_PATH` apuntando a su `node_modules`. Con pptxgenjs 3.12,
  `lineDash` por serie no funciona: la línea Ideal se pone punteada en el post-proceso.

Plan que sigue (documentar solo cuando pase): Daily de la S16 y S17 si el autor las pide; defensa ante comisión en la S17.

### Observaciones de la docente guía (Natalia Abrigo Rubilar, 05-10-2026)

Dejó 11 comentarios en las copias `.docx` del Drive (carpeta `Capstone/entregables`). Se leen
descargando el archivo (el conector solo los muestra en Google Docs nativos) y abriendo
`word/comments.xml`. Se corrigieron **solo en los archivos locales**, como v1.1 (08-10), con
`_herramientas/correcciones_fase1.py` (correr después de `fase1.py` si se regeneran) y
`_herramientas/rol.py` (roles en todos los documentos y scripts):

- DOC-01: cifras con fuente (INE, Censo 2024: 16,3% evangélicos, 2.466.607 personas; Subsecretaría de
  Justicia vía Vergara 240 UDP 2019: 3.819 entidades religiosas, más del 90% evangélicas), marcha blanca
  con una iglesia piloto **después del S14** (planificada, no hecha), capacidad máxima de 26 pts por
  sprint y sección "Fuentes".
- DOC-01 y DOC-02: "no puedes tener 3 roles" → un rol por persona (ver arriba).
- DOC-03: módulos del mapa ↔ épicas de DOC-06. DOC-04: el SuperAdmin también da soporte.
- DOC-05: web responsive (sin app nativa); nueva sección "4. Continuidad y respaldo" (CI + staging,
  rollback en Render, Postgres local con Docker, caída del 07-08 y `supabase db dump` mientras siga el plan
  gratuito; plan Pro con respaldos diarios antes de la marcha blanca); escalabilidad en el pilar 4.
- DOC-07: el movimiento financiero (HU-08) tiene un ID único.

### Plan de los días 6 a 10 del Sprint 2 (histórico: ya documentado, el sprint cerró el 02-10)

| Día | Fecha | Trabajo (tareas del Sprint Backlog) |
|---|---|---|
| 6 | Lun 28-09 | T2.7 (Tesorero/Secretaria cubiertos por el espejo; paso 8 de la Fase 7). Empezar T2.8 WhatsApp |
| 7 | Mar 29-09 | T2.8 WhatsApp: la plantilla queda esperando la aprobación de Meta (impedimento). T2.13 checklist `docs/supabase-todo.md`. Revisar la brecha del burndown (acción acordada) |
| 8 | Mié 30-09 | T2.9 corte: login y refresh reales contra Supabase Auth |
| 9 | Jue 01-10 | T2.10 DATABASE_URL a Supabase + identidad desincronizada (impedimento real del 16-08). T2.11 fix de la confirmación de contraseña |
| 10 | Vie 02-10 | T2.12 sincronizar README y auth-cookies.md. Review, Retro y Release **v1.2.0** (T2.14). Product Backlog → v1.3 |

Días 6 a 9 ya documentados (el 30-09 se adelantó el 01-10 por pedido explícito del autor, solo esa vez).

Burndown del Sprint 2 al 01-10: 55 → 53 → 51 → 48 → 40 → 34 → 27 → 21 → 13 → 6 (ideal 5,5; el atraso
de IMP-07 se recuperó). Quedan para el 02-10: T2.12 (2 h), T2.14 (3 h) y 1 h de T2.8 bloqueada por
IMP-09.

**Decisión del autor (30-09) sobre HU-05:** **no se acepta** porque no cumple la DoD (no hubo envío real;
en la realidad WhatsApp nunca se conectó, ver `FEATURES.md` del 08-09). Vuelve al Product Backlog **sin
sprint asignado** (no se mueve al Sprint 5, porque la v2.0 real tampoco lo tiene). Velocidad prevista
del Sprint 2: 18/26. DOC-07, 08 y 10 siguen mostrando a HU-05 en el Sprint 2, porque son la
planificación original de la Fase 1; el documento vivo es el Product Backlog (DOC-09).

**Borradores de cierre (hechos el 30-09 con el estado al 01-10):** S2-06 Release v1.2.0, S2-07 Review
y S2-08 Retro en **v0.9**, y DOC-09 en **v1.2.1**. Los genera `_herramientas/sprint2_cierre.py`. El
02-10 hay que pasarlos a v1.0 (versión, fecha 02-10, quitar "Borrador" del título, confirmar HU-17
tras T2.12, horas 55/55, burndown final y fila de v1.0 en "Control de versiones"). DOC-09 pasa a v1.3.
Acciones de la Retro para el Sprint 3: no comprometer historias con aprobaciones externas pendientes,
un proyecto de Supabase dedicado para staging, docs dentro de cada tarea y probar RLS antes en un
proyecto de prueba.

## Fase 2 (carpeta `entregables/Fase 2`) — completada el 08-10

Guías y pautas de Duoc para la Fase 2 (asignatura PTY4614 Capstone). Las llena `_herramientas/fase2.py`
(se corre una sola vez sobre los originales; respaldo en `_respaldos/2026-10-08/Fase 2 (antes de completar)/`):

- `2.1` Diario de reflexión: las 6 preguntas respondidas.
- `2.2` Autoevaluación del informe de avance: nivel marcado (☒) en cada indicador, los 10 indicadores de calidad
  evaluados y un resumen con el logro ponderado estimado (74%) y qué falta para llegar al 100%.
- `2.4` Guía 2 (informe de avance): resumen, objetivos (general + OE1–OE6, con ajustes), metodología,
  evidencias, plan de trabajo (12 actividades con estado) y ajustes; más abstract ES/EN y conclusiones y
  reflexión individuales en inglés.
- `2.6` Guía 3 (informe final): borrador al 08-10. Nombre, áreas, competencias, relevancia, objetivos y
  metodología completos; desarrollo y evidencias marcados "se completa al cierre del Sprint 5"; intereses y
  proyecciones como borrador que el autor debe revisar.
- `2.3` (formativa de la docente) y las dos planillas de evaluación **no se tocan**: son instrumentos de la
  docente, y guardarlas con openpyxl borraría sus validaciones de datos.
- Pendiente para el informe: portada, índice, numeración de páginas, anexo con capturas y referencias APA.
  DOC-05 todavía dice "10 iglesias activas a diciembre de 2026", que el informe de avance presenta como ajustado.

## Carpeta de entregables (`C:\Users\rojas\Desktop\entregables`)

- `00 - Listado de documentos - Seguimiento.xlsx`: hoja “Scrum - Seguimiento” (estado de cada
  documento: Completado / En progreso / Pendiente; el título dice “actualizado al …”) y hoja
  “Calendario”. Actualízala cada vez que avances algo.
- `1. Definición del proyecto (S1-S4)/`: DOC-01 a DOC-10. Todo en estado **Completado**. DOC-01, 02, 03,
  04, 05 y 07 están en v1.1 (correcciones de la docente, 08-10). El Product Backlog (DOC-09) es un
  documento vivo: v1.0 03-09, v1.1 17-09, v1.2 21-09, v1.2.1 01-10, v1.3 02-10, v1.4 05-10, v1.5 16-10, v1.6 19-10, v1.7 30-10, v1.8 02-11 y v1.9 13-11 (cierre).
  Lo genera `sprintlib.product_backlog()` (historial en `sprintlib.PB_HIST`).
- `4. Evidencias técnicas/11 - Documento de Diseño …docx` (DOC-11): arquitectura **objetivo** al cierre del Sprint 5.
- `12 - Daily Meeting (S1 a S10).docx` (DOC-12): **un solo registro** para todo el proyecto, con
  versión 1.N, donde N es la cantidad de Daily (hoy 1.75, archivo `12 - Daily Meeting (S1 a S16).docx`). La facilita el Scrum Master (Persona 2). Se renombra cada vez que entra una
  semana nueva (cambiar `PATH` en `daily.py` y la planilla con `xlsx.py`).
- Una carpeta por sprint con `Sx-01 Planning`, `Sx-02 Backlog`, `Sx-03 Scrumboard`,
  `Sx-04 Burndown`, `Sx-05 Impedimentos`, `Sx-06 Release vX.Y.Z`, `Sx-07 Review` y `Sx-08 Retro`.
  Release, Review y Retro se hacen el último día del sprint. La carpeta del Sprint 3 es
  `5. Sprint 3 - RLS multi-tenant y staging (S9-S10)` (el 4 lo usa "Evidencias técnicas"); las de los
  Sprints 4 y 5 son `6. Sprint 4 - QA de seguridad, k6 y Realtime (S11-S12)` y `7. Sprint 5 - Correo, convocatorias y producción (S13-S14)`. Se crean copiando los documentos del sprint anterior y
  reemplazando en el XML "Sprint N", "SN-0" y las semanas.
- `_respaldos/AAAA-MM-DD/`: copias previas a cada edición grande.
- **Repo de la tesis** (`https://github.com/Cofre-dev/Evangelicapp-capstone`, clon local en
  `C:\Users\rojas\Documents\GitHub\Evangelicapp-capstone`): `backend/` y `frontend/` son copias del código
  (al 29-10 iguales a los repos de origen, salvo finales de línea) y `tesis/` es una copia de `entregables` **sin**
  `_herramientas`, `_respaldos` ni `Fase 2`. Para actualizarlo: `git rm -r tesis`, copiar de nuevo y hacer commit con
  `docs(tesis): documentación Scrum del Proyecto APT al DD-MM-AAAA`. Último sync: 23-11 (commit `543d01a`, **sin push**: el autor decide cuándo subirlo).
  Pendiente que decida el autor: el README de ese repo todavía dice que una sola persona asume los 3 roles de Scrum.
- `EvangelicApp - Presentación de avance (29-10-2026).pptx`: deck de 21 diapositivas (problema, solución, roles,
  arquitectura, seguridad RLS, modelo ER, diccionario, Scrum, cronograma, velocidad, burndown del Sprint 4, QA,
  impedimentos y próximos pasos). Diagramas y gráficos nativos (editables en PowerPoint). Lo genera
  `_herramientas/presentacion/build.js` (pptxgenjs; `node build.js "<salida>.pptx"` con `NODE_PATH` apuntando a un
  `node_modules` con pptxgenjs, react-icons, react, react-dom y sharp, y `PPTX_SKILL` a la skill pptx por
  `apply_theme.js`). `render.py` hace un render aproximado a PNG para QA, porque aquí no hay PowerPoint ni LibreOffice.
  Al actualizarla para otra fecha, cambiar las cifras (puntos, Daily, burndown, release) en `build.js`.
- `_herramientas/`: scripts de Python (python-docx, openpyxl, matplotlib) que generaron la
  re-planificación. `dx.py` edita los `.docx` conservando el formato (clona filas, párrafos y
  bloques); `plan.py` tiene las 32 HU y los sprints; `daily.py` tiene todas las Daily;
  `sprint1.py` … `sprint5.py`, `sprint5_cierre.py`, `cierre_proyecto.py` e `informe_final.py` generan los
  documentos de cada sprint (y el Product Backlog; `sprintlib.clone_docx()` crea los de un sprint nuevo copiando los del anterior); `xlsx.py` actualiza la planilla; `figures.py` hace los burndown,
  el Impact Map y el Story Map; `gantt.py` renderiza la Gantt con Chrome headless. Necesitan una
  subcarpeta `out/` junto a ellos. En este equipo no hay Word ni LibreOffice: se valida
  extrayendo el texto y revisando que el XML esté bien formado.

## Convenciones de formato (copiarlas exactas)

- Todos los documentos parten con una tabla de encabezado: Proyecto (“EvangelicApp — Plataforma de
  gestión para iglesias evangélicas de Chile”), Documento (“S2-02 — Sprint Backlog — Sprint 2”),
  Marco de trabajo (Scrum), Sprint / Fase, Fecha (DD-MM-AAAA), Versión y Autor
  (“Matías Cofré (Developer)”). Casi todos terminan con
  la tabla “Control de versiones”.
- Estilo: título en negrita de 20 pt, color #1F3A5F; encabezados de tabla con fondo #1F3A5F y texto
  blanco; columna clave con fondo #E8EEF6.
- Numeración: épicas EP-xx, historias HU-xx, tareas T<sprint>.<n>, impedimentos IMP-xx
  (correlativo entre sprints).
- Daily: “Semana Sx” (Heading 1) → “Daily #NN — Lun DD-MM-AAAA” (Heading 3) → una tabla de 4 filas:
  Fase / Sprint (“Sprint 2 · Día 5”), ¿Qué hice ayer?, ¿Qué haré hoy? e Impedimentos.
- Burndown: tabla Día / Horas restantes con una columna por día hábil, gráfico real vs. ideal y
  un análisis en viñetas.
- Definition of Done: código en main con CI en verde; desplegado y con smoke test documentado;
  criterios de aceptación verificados; FEATURES.md y README actualizados.

## Estado actual

- **Última actualización:** 23-11-2026 (lunes, S16).
- Documentación al día hasta el **lunes 23-11-2026** (incluido, a pedido del autor): Daily #75, Sprint 5 cerrado (v2.0.0,
  23/23), Retrospectiva del proyecto, Guía 3 completada, planilla al 23-11 y presentación final. Respaldo previo en
  `_respaldos/2026-11-23/` (incluye Fase 2, la presentación de avance y los scripts en `herramientas/`).
- **Próximo paso:** lo que pida el autor para la defensa (S17): Daily de la S16–S17, ensayo de la presentación, push del
  repo de la tesis.
- Pendientes del autor: portada, índice, APA y capturas del informe final; revisar la sección 6 (personal) de la Guía 3;
  nombres de Persona 1 y 2; README del repo de la tesis (todavía dice que una persona asume los 3 roles); DOC-05 todavía
  dice "10 iglesias activas a diciembre de 2026".
- **Nombre del autor:** Matías Cofré (Developer). Persona 1 (PO) y Persona 2 (SM) siguen sin nombre.
