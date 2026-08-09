# Brief para frontend: logoUrl/fotoUrl ahora son URLs absolutas de Supabase Storage

## Contexto

El backend migró el storage de logos de iglesia y fotos (perfil, integrantes) de disco local a Supabase Storage (Fase 1 de `docs/supabase.md`, ver entrada `[2026-08-08 21:35]` en `FEATURES.md`). Esto **cambia el formato de los valores que ya te está devolviendo la API** en los campos `logoUrl` y `fotoUrl` — no hay endpoints nuevos ni cambia el flujo de subida.

**Antes:**
```json
{ "logoUrl": "/uploads/logos/101c5e46-f563-411c-b8f5-345922628acb.png" }
```
Ruta relativa. Para mostrarla en un `<img>` había que prefijarla con la URL del backend (`API_URL` / `BACKEND_URL`, según cómo la tengan nombrada).

**Ahora:**
```json
{ "logoUrl": "https://lkcgiqmgdefhxhckedga.supabase.co/storage/v1/object/public/logos-iglesias/101c5e46-f563-411c-b8f5-345922628acb.png" }
```
URL absoluta, pública, autocontenida. Se usa **tal cual**, sin prefijo.

Aplica a los 3 campos: `Iglesia.logoUrl`, `Usuario.fotoUrl`, `Integrante.fotoUrl` (en cualquier endpoint que los devuelva: `GET /mi-iglesia`, `GET /auth/me`, `GET /integrantes`, la respuesta de login, `GET /integrantes/registro/:qrToken`, `GET /agenda/asistencias/:token`, etc.).

## Lo que SÍ tiene que cambiar en el frontend

**Buscar y corregir cualquier lugar que concatene una URL base con `logoUrl`/`fotoUrl`.** Ese patrón ahora produce una URL rota (URL absoluta pegada dentro de otra URL). Encontré un caso concreto en el repo, en la carpeta a la que tengo acceso:

- **Archivo:** `frontend/src/app/agenda/asistencia/[token]/page.tsx`, línea 104
- **Código actual:**
  ```tsx
  <Image
    src={`${API_URL}${data.iglesia.logoUrl}`}
    alt={`Logo de ${data.iglesia.nombre}`}
    width={56}
    height={56}
  />
  ```
- **Corrección:** usar `data.iglesia.logoUrl` directo, sin el prefijo `API_URL`:
  ```tsx
  <Image
    src={data.iglesia.logoUrl}
    alt={`Logo de ${data.iglesia.nombre}`}
    width={56}
    height={56}
  />
  ```
  (Ojo con el `if` que lo envuelve — sigue siendo necesario, `logoUrl` puede venir `null`.)

Solo tengo acceso a esa carpeta del repo de frontend, así que **no pude auditar el resto** — hay que grepear el proyecto completo por los mismos patrones:
- Cualquier `` `${API_URL}${...logoUrl}` `` / `` `${BACKEND_URL}${...logoUrl}` `` / `` `${API_URL}${...fotoUrl}` ``
- Pantallas candidatas por lo que existe hoy en el backend: login/sidebar (logo de la iglesia del usuario logueado), perfil de usuario (foto de perfil), listado de integrantes (censo), landing pública de registro por QR, confirmación de predicador/asistencia por email (la que ya encontré).

**Si usan `next/image` (el componente `<Image>` de Next.js, no un `<img>` plano) en alguna de esas pantallas:** Next.js exige que el dominio de cualquier imagen externa esté explícitamente permitido en `next.config.js` (`images.remotePatterns` o `images.domains`), si no tira un error en runtime ("Invalid src prop... hostname is not configured"). Hay que agregar el dominio de Supabase Storage:
```js
// next.config.js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'lkcgiqmgdefhxhckedga.supabase.co' },
  ],
},
```
No pude confirmar si esto ya está configurado (no tengo acceso a `next.config.js` en este repo) — hay que revisarlo. Sin este paso, aunque se corrija el bug de concatenación de arriba, la imagen no va a cargar.

Si en algún lugar usan una Content Security Policy (`img-src` en headers/meta), también hay que sumar ese dominio ahí.

## Lo que NO cambia (para tranquilidad)

- **El flujo de subida es idéntico**: mismos endpoints, mismo `multipart/form-data`, mismos nombres de campo (`logo`, `foto`), mismas reglas de validación (mimetype/tamaño máximo) — todo eso sigue viviendo y validándose en el backend, no hay nada nuevo que implementar del lado del envío.
- **Los nombres de los campos en las respuestas no cambiaron**: siguen siendo `logoUrl` / `fotoUrl`, siguen siendo `string | null`. No hay que tocar tipos/DTOs del frontend, solo cómo se **usa** el valor al armar el `src`.
- No hay endpoints nuevos que integrar.

## Checklist de QA sugerido

- [ ] Grepear todo el repo de frontend por `logoUrl` y `fotoUrl` y revisar cada uso.
- [ ] Confirmar que ningún lugar sigue prefijando esos valores con `API_URL`/`BACKEND_URL`.
- [ ] Si usan `next/image`, agregar `lkcgiqmgdefhxhckedga.supabase.co` a `images.remotePatterns` en `next.config.js`.
- [ ] Probar visualmente: logo de iglesia (dashboard/sidebar), foto de perfil, censo de integrantes, landing pública de registro QR, y la pantalla de confirmación de asistencia por email (`agenda/asistencia/[token]`) que ya sé que tiene el bug.
- [ ] Verificar que sigue mostrando el estado vacío correctamente cuando `logoUrl`/`fotoUrl` es `null` (no cambió esa lógica, pero vale la pena confirmar junto con lo demás).
