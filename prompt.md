# Prompt — Consentimiento de datos en el censo de integrantes (frontend)

Contexto para copiar/pegar en una sesión de Claude Code sobre el repo del **frontend**
(Next.js). Esto es trabajo 100% de frontend — el backend no cambia con este pedido.

---

```
Necesito agregar una casilla de consentimiento obligatoria en la landing pública de
registro de integrantes (el formulario al que llega la gente al escanear el QR de la
iglesia). Es requisito legal: la Ley 21.719 de protección de datos personales en Chile
entra en vigencia el 1 de diciembre de 2026 y exige evidencia de consentimiento
informado antes de recolectar datos personales.

CONTEXTO TÉCNICO (no lo inventes, es el contrato real del backend):

- La landing consume estos dos endpoints del backend:
  - GET  /integrantes/registro/:qrToken   -> datos de la iglesia para mostrar en la landing
  - POST /integrantes/registro/:qrToken   -> envía el registro (multipart/form-data)
- El body del POST son exactamente estos campos, sin nada más:
  - nombreCompleto (string, requerido)
  - email (string, requerido, formato email)
  - telefono (string, requerido)
  - run (string, requerido, formato RUN chileno)
  - miembroDesde (string, fecha ISO, requerido, no puede ser fecha futura)
  - foto (archivo, opcional)
- El backend tiene un ValidationPipe global con `whitelist: true` y
  `forbidNonWhitelisted: true`: si mandas un campo que el DTO no espera (por ejemplo un
  booleano de "acepto la política"), el request entero es rechazado con 400. No agregues
  ningún campo nuevo al body — el backend todavía no tiene dónde guardar el
  consentimiento (eso es un cambio de backend aparte, ya identificado, no lo asumas
  resuelto).

QUÉ QUIERO QUE IMPLEMENTES:

1. Un checkbox, desmarcado por defecto, ubicado justo antes del botón de enviar del
   formulario de registro.
2. Texto junto al checkbox, con un link embebido: algo como "He leído y acepto el
   [tratamiento de mis datos personales]" donde el link abre la política de privacidad
   en una pestaña nueva.
3. El link debe apuntar a una URL configurable (variable de entorno o constante fácil
   de encontrar) — hoy no existe la página de política todavía, así que usa un
   placeholder claro (ej. `/politica-privacidad` o `NEXT_PUBLIC_URL_POLITICA_PRIVACIDAD`)
   que se pueda reemplazar después sin tocar el componente del formulario.
4. El botón de enviar debe quedar deshabilitado mientras el checkbox no esté marcado.
   No agregues validación de servidor para esto — es puramente un gate del lado del
   cliente, porque el backend no recibe ni valida este campo todavía.
5. No cambies nada más del formulario: ni los campos existentes, ni el endpoint, ni el
   formato del body que ya se envía.

No implementes la página de política de privacidad en sí (eso lo maneja el equipo de
producto/legal aparte) — solo el checkbox, el texto, el link con placeholder, y el gate
del botón.
```

---

**Nota para el equipo (no es parte del prompt de arriba):** este consentimiento hoy
solo bloquea el envío en el cliente — el backend no lo persiste todavía (no hay dónde
guardar *cuándo* y *qué versión* de la política aceptó cada `Integrante`). Sin eso, el
checkbox no sirve como evidencia real ante una fiscalización. Es un cambio de backend
aparte (agregar campos a `Integrante` + al DTO de registro) que hay que decidir cuándo
hacer — no se implementó en esta pasada porque el pedido fue explícitamente para el
frontend.
