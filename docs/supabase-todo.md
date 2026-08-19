# TODO — Supabase: estado, lo que falta, lo que haremos

Checklist de seguimiento rápido del plan completo en `docs/supabase.md` (8 fases, con el
detalle técnico de cada una). Este archivo es solo el estado — para el paso a paso de cada
fase, leer el documento original. Se actualiza cada vez que avanza algo, mismo criterio de
bitácora que `FEATURES.md`.

## Hecho ✅

| Fase | Qué | Cerrado |
|---|---|---|
| 1 | Storage: logos/fotos migrados de disco local a Supabase Storage (3 buckets públicos de lectura) | 2026-08-08 |
| 2 | Resize/compresión de imagen al subir (`sharp`) — logos 512×512, fotos 256×256 | 2026-08-09 |
| 3 | Caché de PDFs de certificados de ceremonias en bucket privado (`certificados-ceremonias`) | 2026-08-09 |
| 4 | Cron de recordatorios de facturación (7 días antes + cada 2 días en mora) + historial de pagos (`PagoIglesia`) + fecha de adquisición del plan | 2026-08-10 |
| 5 | Realtime para las 3 pantallas (SuperAdmin, evento del pastor, censo en vivo) — **decisión propia: WebSocket propio en el backend, no Supabase Realtime nativo**, para no depender de que RLS (Fase 8) esté activo | 2026-08-13 |
| 7 | **Completa, incluido el cutover final Y probada contra la base de datos real (no solo la de pruebas local).** Proyecto de prueba, login por email, espejo a `auth.users`, verificación JWKS, guard con las 3 revalidaciones, decisión de mantener cookies httpOnly + CSRF propio — y ahora `POST /auth/login`/`POST /auth/refresh` hablan de verdad con GoTrue (server-to-server), con fallback auto-sanador para contraseñas desincronizadas. De paso se corrigió `RealtimeGateway` (Fase 5), que verificaba el token de forma independiente y se habría roto con el cutover. Al pasar `DATABASE_URL` de Postgres local al proyecto real de Supabase (2026-08-16) aparecieron y se corrigieron dos bugs reales adicionales: identidad de Supabase Auth cruzada entre bases (una cuenta con el mismo email+password ya existía en el proyecto de Auth desde pruebas contra Postgres local, con `app_metadata` apuntando a una fila que no existe en la base real) y `verifyPassword`/`changePassword` (usados en toda confirmación de contraseña — facturación, borrar ceremonias/movimientos) seguían comparando solo contra bcrypt local en vez de Supabase, además de devolver 401 en vez de 403 ante una contraseña de confirmación incorrecta (causaba que el frontend cerrara sesión en vez de mostrar un error). Ver entradas del 2026-08-15 y 2026-08-16 en `FEATURES.md`. | 2026-08-14 al 2026-08-16 |

**Nota sobre la Fase 4:** `docs/supabase.md` no tiene una línea de "Actualización" marcándola resuelta como sí tienen las Fases 5 y 7 — es solo que quedó sin anotar ahí, pero está hecha (ver entrada del 2026-08-10 en `FEATURES.md`). Vale la pena ir a marcarla en algún momento para que el documento original no quede engañoso.

**Comportamiento real distinto a lo asumido en el plan original:** GoTrue tiene un período de gracia de reuso de refresh tokens (~10s) pensado para reintentos de red del cliente — reintentar un token recién rotado dentro de esa ventana no se trata como robo, a diferencia de la detección de reuso local que reemplazó (instantánea, sin gracia). No es un bug, es el comportamiento real de Supabase — ver detalle en `FEATURES.md`.

## Bloqueado 🚫

| Fase | Por qué |
|---|---|
| 6 — Webhook de pagos | `CLAUDE.md` marca el modelo de negocio (quién paga, con qué pasarela) como pendiente de definir con el fundador. Construir el receptor de un proveedor que todavía no se eligió es trabajo especulativo — no se empieza hasta que haya una decisión de negocio. |

## Pendiente ⏳

| Fase | Qué falta exactamente |
|---|---|
| 8 — RLS | Ahora sí puede empezar (la Fase 7 ya está cortada de verdad y el JWT de Supabase trae `iglesia_id` confiable en `app_metadata`). Sigue teniendo un caveat técnico sin resolver: Prisma no abre conexiones "como el usuario autenticado", así que hay que decidir explícitamente cómo se combina RLS con el pool de conexión que usa Prisma hoy — no alcanza con activar las policies y asumir que ya quedó protegido. |

**No incluido en el cutover, a considerar por separado:** borrar el modelo `RefreshToken` del schema (se dejó de usar pero no se tiró la tabla — migración aparte, después de confirmar que el corte funciona sin sobresaltos); una conexión real de WebSocket contra el `RealtimeGateway` corregido no se probó en vivo (sí se verificó por compilación y por compartir el mismo patrón ya probado del guard HTTP); el camino de `IglesiaSuspendidaException` en el login/guard nuevo no se re-probó explícitamente (lógica sin cambios respecto a la versión anterior, ya validada).

## Lo que haremos (orden sugerido, no empieza solo)

1. **Nada de esto se toca sin tu OK explícito** — mismo criterio que se ha seguido en todas las fases anteriores, en particular para RLS por tocar el aislamiento multi-tenant.
2. Cuando quieras retomar: definir primero cómo se resuelve el caveat de Prisma + RLS (probablemente `set_config` por request, o aceptar que RLS solo protege el acceso vía API de Supabase y no vía Prisma) antes de escribir ninguna policy.
3. La Fase 6 (webhook de pagos) queda fuera de esta secuencia hasta que definamos el modelo de negocio — no es un tema técnico, es una conversación pendiente contigo/el fundador.
