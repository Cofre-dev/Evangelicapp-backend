# EvangelicApp — Contexto de producto y negocio

Este archivo lo lee Claude automáticamente al iniciar cualquier sesión en este repositorio. Contiene el **por qué** del proyecto (negocio/producto). Para el **cómo** técnico (stack, arquitectura, setup), ver [`README.md`](./README.md). Para el historial de cambios, ver [`FEATURES.md`](./FEATURES.md).

## Bitácora obligatoria

Cada vez que Claude haga una modificación en este repositorio (código, config, docs), debe agregar una entrada nueva al final de `FEATURES.md` con fecha y hora, los cambios realizados y para qué sirven. Es un archivo de solo agregar: nunca borrar ni reescribir entradas anteriores. Esto aplica dentro de la misma sesión también — si se hacen varios cambios de una sesión, se puede agrupar en una sola entrada al terminar, pero no se debe cerrar una tarea de modificación sin dejarla registrada.

## Qué es

EvangelicApp es una plataforma de gestión para iglesias evangélicas de Chile: agenda de eventos y predicadores, finanzas (ingresos/egresos con auditoría), y notas/tareas internas del equipo pastoral. El objetivo declarado del fundador es que sea una herramienta seria y duradera, con alcance a nivel nacional — no un MVP desechable.

Este repo es **solo el backend**. El frontend (con el que consume esta API) vive en un repositorio aparte, por decisión deliberada de no usar monorepo.

## Problema que resuelve

Muchas iglesias evangélicas en Chile hoy gestionan esto de forma manual o dispersa: agenda en papel/WhatsApp, finanzas en cuadernos o planillas sueltas sin trazabilidad, coordinación de predicadores por llamadas. EvangelicApp centraliza eso en una sola plataforma pensada para el equipo pastoral (pastor, tesorero, secretaria), con control de acceso por rol y trazabilidad de lo financiero.

## Modelo de tenant (cómo funciona hoy)

Cada **iglesia** es un tenant independiente y aislado — sus datos (eventos, movimientos financieros, notas, usuarios) nunca se cruzan con los de otra iglesia. La plataforma la opera un **SuperAdmin** (el equipo de EvangelicApp), que:

1. Da de alta una nueva iglesia junto con su **Pastor** (transacción única — no existe iglesia sin pastor a cargo).
2. El pastor recibe credenciales temporales, hace login, cambia su contraseña y completa un onboarding (datos personales + tamaño de la congregación).
3. El pastor invita a su propio equipo — Tesorero y/o Secretaria — quienes ven solo su iglesia.
4. El SuperAdmin tiene un dashboard con visibilidad cruzada (todas las iglesias, distribución por región) para operar la plataforma a nivel nacional, pero **no** ve el detalle financiero/operativo interno de cada iglesia.

Roles y para qué sirve cada uno en términos de negocio:

| Rol | Quién es | Qué hace en la plataforma |
|---|---|---|
| SUPER_ADMIN | Equipo de EvangelicApp (operador de la plataforma) | Alta de iglesias, métricas agregadas a nivel nacional |
| PASTOR | Líder de la iglesia, dueño de la cuenta | Gestiona su equipo, agenda, finanzas, notas/tareas |
| TESORERO | Encargado de finanzas de la iglesia | Movimientos financieros, categorías, export contable, agenda |
| SECRETARIA | Apoyo administrativo de la iglesia | Agenda, sus propias tareas asignadas |
| MIEMBRO | Congregante | Rol modelado en la base de datos; **todavía sin funcionalidad propia** — pendiente de definir su alcance (¿ver agenda pública de su iglesia? ¿app de miembro a futuro?) |

## Modelo de negocio (a completar)

Esta sección está deliberadamente incompleta — no hay información suficiente en el código o en las conversaciones registradas para documentar esto con certeza, y prefiero dejarlo marcado como pendiente en vez de inventarlo. Antes de tomar decisiones de producto que dependan de esto (límites por plan, features premium, etc.), conviene resolver con el fundador:

- **Monetización**: ¿gratis para las iglesias (financiado por donaciones/patrocinio a nivel de organización), suscripción mensual por iglesia, freemium (agenda gratis, finanzas de pago), u otro esquema?
- **Quién paga**: ¿la iglesia individual, una denominación/asociación que agrupa varias iglesias, un patrocinador externo?
- **Métrica de éxito del negocio**: ¿número de iglesias activas, iglesias que completan onboarding, retención mes a mes, algo distinto?
- **Estrategia de distribución**: ¿alguna denominación/red de iglesias como canal de entrada, o adopción iglesia por iglesia?
- **Alcance geográfico real del roadmap**: el modelo de datos ya soporta multi-región (`Iglesia.region`, `Iglesia.comuna`) pensando en escala nacional — confirmar si el lanzamiento es gradual (una región primero) o nacional desde el inicio.

Cuando el usuario entregue esta información, reemplazar esta sección con el modelo real (no dejar ambas versiones).

## Prioridades al trabajar en este repo

Dado el objetivo de que esto persista en el tiempo y tenga impacto nacional:

- **Confiabilidad sobre velocidad**: este software maneja datos financieros y personales de organizaciones religiosas reales; preferir la solución robusta aunque tome más tiempo.
- **No romper el aislamiento multi-tenant** bajo ninguna circunstancia — es la garantía de seguridad más importante del sistema (ver patrón `iglesiaId` desde JWT en `README.md`).
- **Mantener el patrón existente** en vez de introducir uno nuevo por endpoint/módulo — la consistencia importa más que la elegancia local.
- Antes de agregar una dependencia o reescribir algo grande, confirmar con el usuario — es un proyecto en etapa temprana pero con intención de largo plazo, no un prototipo para tirar.
