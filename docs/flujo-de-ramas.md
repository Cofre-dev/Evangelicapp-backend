# Ramas y flujo de trabajo (backend y frontend)

Estado verificado el **2026-11-26** contra git, Render y el README del frontend. Si cambia la
configuración de despliegue, actualizar este archivo primero.

## Lo más importante

> **No existe un entorno de pruebas separado.** La rama `staging` **es producción** en los dos
> repos: todo push a `staging` se despliega solo y queda en línea. El nombre "staging" es
> histórico (ver `FEATURES.md` 2026-08-25 y 2026-09-09); se mantiene porque Render y Cloudflare
> están configurados con ese nombre.

| Repo | Rama | Qué es | Se despliega a |
|---|---|---|---|
| Backend (`Evangelicapp-backend-1`) | `staging` | **Producción** (tronco real) | Render `Evangelicapp-backend` → `api.evangelicapp.cl`, auto-deploy en cada push. Base: Supabase `Backend-staging` (que también es producción) |
| Backend | `main` | Copia de `staging` (se iguala a mano con fast-forward). Rama por defecto de GitHub | Nada. Ojo: el CI (`.github/workflows/ci.yml`) hoy solo corre en push/PR a `main` |
| Backend | `testing` | **Rama de integración y pruebas**: acá se juntan las features nuevas antes de pasar a `staging`. Actualizada a `staging` el 2026-11-26 | Nada todavía (se prueba en local; ver "Pendiente de decidir") |
| Frontend (`Evangelicapp/frontend`) | `staging` | **Producción** | Cloudflare Worker `evangelicapp` → `app.evangelicapp.cl`, build en cada push |
| Frontend | `main` | Desactualizada respecto de `staging` (y con 5 commits propios) | Nada |

### Ramas viejas (no usar)

En los dos repos existen `features` y `features-local` (backend: julio y agosto de 2026). Están
**completamente incluidas** en `main`/`staging` (no tienen commits propios en el backend) y no
se despliegan a ningún lado. Son candidatas a borrarse; no crear trabajo nuevo sobre ellas.
En el frontend, `testing` todavía es la rama vieja (sin actualizar).

## Flujo para una feature nueva

```
feature/<nombre>  ──PR──▶  testing  ──PR──▶  staging (producción)  ──ff──▶  main
   (se programa)        (se prueba todo junto)     (se despliega solo)        (copia)
```

1. **Partir siempre desde `testing` actualizado**, en una rama propia:

   ```bash
   git switch testing && git pull
   git switch -c feature/<nombre-corto>      # ej. feature/reporte-financiero-congregacion
   ```

2. **Programar y probar la feature sola, en local** (nunca contra producción):
   - Backend: Postgres local con `backend/docker-compose.yml` (`DATABASE_URL` del `.env`
     apuntando ahí), `npm test`, `npm run lint:ci`, `npm run build`.
   - Frontend: `npm run dev` apuntando al backend local (`NEXT_PUBLIC_API_URL`).

3. **Mergear la feature a `testing`** y volver a probar ahí todo junto (las features que
   estén esperando su pase a producción conviven en `testing`).

4. **Si hay migración de base de datos:** probarla en local y, si toca RLS / roles /
   `realtime`, en un **branch de Supabase** efímero de `Backend-staging` (ver README del backend,
   "Migraciones de base de datos").

5. **Pasar a producción, en este orden** (el orden importa: el build de Render **no** aplica
   migraciones, así que código nuevo con una base vieja se cae):
   1. Aplicar las migraciones pendientes en producción (`Backend-staging`).
   2. Mergear `testing` → `staging` en el backend (PR) → Render despliega.
   3. Mergear `testing` → `staging` en el frontend → Cloudflare despliega.
   4. Smoke test en `app.evangelicapp.cl`.
   5. Igualar `main` con `staging` (`git switch main && git merge --ff-only staging && git push`).

6. **Nunca hacer push directo a `staging`**: es producción. Todo entra desde `testing`.
   Un arreglo urgente de producción (hotfix) puede ir de una rama `hotfix/<nombre>` directo a
   `staging`, pero después se mergea también a `testing` para que no se pierda.

## Pendiente de decidir

- **CI en `testing` y `staging`:** hoy el CI solo corre en push/PR a `main`. Conviene agregar
  `testing` y `staging` a los `branches` de `ci.yml`, y proteger `staging` en GitHub (solo por PR).
- **Probar `testing` en línea:** hoy `testing` solo se puede probar en local. Para probarla en
  una URL real hace falta un entorno propio: un segundo servicio en Render que despliegue
  `testing`, una base separada de producción y la URL de preview de Cloudflare para el frontend.
  Tiene costo mensual; conviene antes de la próxima demo importante o de la primera iglesia real.
- **Ramas viejas:** borrar `features` y `features-local` de los dos repos; actualizar `testing` del frontend.
