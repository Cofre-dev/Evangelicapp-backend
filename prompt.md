# Prompt — Frontend: fix CSRF 403 en todas las mutaciones + imágenes 400 en staging

Copiar/pegar en una sesión de Claude Code sobre el repo del **frontend** (Next.js).

El fundador hizo QA de todos los módulos contra el deploy de Cloudflare Workers
(`evangelicapp.rojascofrem.workers.dev` → backend `evangelicapp-backend.onrender.com`) y le
aparece, en cada módulo:

- `403 (Forbidden)` en TODA request mutante (POST/PUT/PATCH/DELETE), con el mensaje
  **"Token CSRF inválido o ausente"** — `/auth/heartbeat`, `/notas`, `/usuarios`,
  `/ceremonias/*`, `/mi-iglesia`, `/accesos/*`, `/integrantes/*`, `/auth/me`, etc.
- `400 (Bad Request)` en `/_next/image?url=https%3A%2F%2Fwoerftoeqarupnrggupl.supabase.co%2F...`
  (logos, fotos de perfil, fotos de integrantes).

**El backend NO cambió y está verificado OK** con curl: login → `/auth/refresh` → mutación
con `X-CSRF-Token` correcto → 200/204. El problema es 100% del lado del cliente.

---

## Bug 1 — CSRF 403 en todas las mutaciones

### Causa (confirmada)

`api.ts` guarda el `csrfToken` en una variable en memoria (`let csrfToken`). El backend hace
double-submit: compara el header `X-CSRF-Token` contra la cookie `csrf_token`. Esa cookie es
**compartida entre pestañas** y se reescribe en cada login/refresh. La variable en memoria
**no** — es por pestaña.

Cuando una pestaña vieja queda abierta y en otro lado se establece una sesión nueva
(re-login después de un reset de contraseña, otra pestaña, un redeploy), la cookie
`csrf_token` pasa a valer `W` pero la pestaña vieja sigue mandando `X-CSRF-Token: X` (viejo)
→ **403 en toda mutación**.

Y no se recupera nunca: `apiFetch` hace refresh+retry **solo ante 401**, no ante 403. El
`access_token` de esa pestaña sí es válido (se comparte por cookie), así que los GET andan y
solo fallan las mutaciones — exactamente el síntoma.

El reset de contraseña lo hace muy visible: el backend revoca el refresh token de Supabase
(confirmado: `/auth/refresh` con el token viejo → 401) pero **no** el `access_token` (vive
~15 min) ni el store de zustand. La página `/recuperar-contrasena/[token]` redirige a
`/login?reset=ok`, el store todavía tiene `usuario`, `/login` redirige de vuelta a la app
→ sesión a medias + `csrfToken` en memoria desincronizado.

### Fix

**1) `src/lib/api.ts` — reintentar una vez ante un 403 de CSRF (igual que el 401).**

En `apiFetch`, justo después del bloque que maneja el 401:

```ts
let res = await rawFetch(path, options);

if (res.status === 401 && path !== REFRESH_PATH) {
  const refreshed = await refreshSession();
  res = refreshed ? await rawFetch(path, options) : res;
}

// El csrfToken en memoria quedó desincronizado de la cookie csrf_token (sesión
// rotada en otra pestaña, redeploy, reset de contraseña). refreshSession() trae
// un csrfToken nuevo y lo guarda; reintentar una vez lo resuelve. Si el refresh
// tampoco anda (refresh token muerto tras un reset), la sesión es irrecuperable.
if (
  res.status === 403 &&
  MUTATING_METHODS.has(method) &&
  path !== REFRESH_PATH &&
  !isCsrfExempt(path)
) {
  const csrfErr = await res.clone().json().catch(() => null);
  if (csrfErr?.message === "Token CSRF inválido o ausente") {
    if (await refreshSession()) {
      res = await rawFetch(path, options);
    } else {
      setCsrfToken(null);
      useAuthStore.getState().clearSession();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError(401, "Tu sesión expiró. Inicia sesión de nuevo.");
    }
  }
}
```

(`res.clone()` para no consumir el body antes del manejo de error de más abajo.)

**2) `src/app/recuperar-contrasena/[token]/page.tsx` — desloguear de verdad antes de redirigir.**

El comentario dice "El backend ya cerró las sesiones del usuario" pero no es cierto: el
`access_token` sigue vivo y el store también. Antes del `router.replace("/login?reset=ok")`:

```ts
import { setCsrfToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
// ...
      await apiFetch<{ ok: true }>("/auth/reset-password", { /* ... */ });
      setCsrfToken(null);
      useAuthStore.getState().clearSession();
      router.replace("/login?reset=ok");
```

Así el usuario llega a `/login` genuinamente deslogueado y entra limpio con la nueva
contraseña.

**3) (Opcional, defensa extra) sincronizar el `csrfToken` entre pestañas.** Con un
`BroadcastChannel("evangelicapp-csrf")`: en `setCsrfToken`, además de setear la variable,
`postMessage(token)`; y un listener que actualice la variable al recibirlo. No es
imprescindible si están los fixes 1 y 2, pero elimina la ventana de desincronización.

### Workaround inmediato (mientras no esté el fix)

Cerrar las pestañas viejas de la app y recargar (F5). Cada carga fresca vuelve a pedir un
`csrfToken` acorde a la cookie.

---

## Bug 2 — `_next/image` 400 en imágenes de Supabase Storage

### Causa

`next.config.ts` → `images.remotePatterns` solo permite `lkcgiqmgdefhxhckedga.supabase.co`
(proyecto Supabase `Backend`, el de producción). El deploy de **staging** sirve las
imágenes desde `woerftoeqarupnrggupl.supabase.co` (`Backend-staging`). El optimizador de
`next/image` (`/_next/image`) rechaza cualquier host que no esté en `remotePatterns` → 400.

### Fix (elegí uno)

**A (recomendado — ya está previsto en el config):** setear `NEXT_IMAGES_UNOPTIMIZED=true`
en las variables de entorno del deploy de Cloudflare Workers. `next.config.ts` ya tiene
`images.unoptimized: process.env.NEXT_IMAGES_UNOPTIMIZED === "true"`; con eso `next/image`
se comporta como `<img>` plano, no pasa por `/_next/image`, y no hay 400. Es la salida
"gratis" para Cloudflare (la optimización on-the-fly cuesta en CF Workers — ver el comentario
del propio `next.config.ts`).

**B:** en `next.config.ts`, derivar el host permitido de `NEXT_PUBLIC_SUPABASE_URL` en vez
de hardcodear `lkcgiqmgdefhxhckedga.supabase.co`, o agregar
`woerftoeqarupnrggupl.supabase.co` a `remotePatterns`. Menos limpio (hay que tocar el config
por cada proyecto) pero mantiene la optimización donde sí es gratis (Vercel).

---

## Qué NO tocar

- El backend está bien. No hace falta ningún cambio ahí para estos dos bugs.
- No cambiar el flujo de cookies/CSRF de `apiFetch` más allá del retry del Bug 1.
- El `X-CSRF-Token` y la cookie `csrf_token` ya están bien nombrados y alineados con el
  backend — no es un problema de nombres ni de CORS (el 403 llega con body JSON del backend,
  la request pasa el preflight sin problema).

---

**Nota para el equipo (no es parte del prompt):** además de estos dos, sigue pendiente el
bloque de features anterior (recuperación de contraseña ya se implementó; falta el
`asistencia:respondida` en `AsistenciasDialog` si no se hizo, y el hint del predicador).
Verificar contra este mismo checklist tras el fix.
