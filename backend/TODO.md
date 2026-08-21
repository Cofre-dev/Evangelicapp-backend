1.- Implementar resend de pago con cuenta
    - Verificar la imagen que se envia en los correos
2.- Comprar dominio y hosting
3.- Mitigar las medidas de seguridad de sonarqube
6.- Pasarela de pagos (para evangelicapp) — hoy los pagos se confirman a mano (`POST /iglesias/:id/marcar-pagada`), sin pasarela real todavía
7.- Pasarela de pagos (Para donaciones de las iglesias)

- [RESUELTO] Implementar un modulo de roles para el pastor, donde le de acceso a los modulos a cada integrante, así eliminando el rol de pastor y tesorero. — ver módulo `accesos` (rol MANAGER/USUARIO + `AccesoModulo`).
- La base de datos ahora vive en Supabase (proyecto `evangelicapp`) — confirmar si el hosting de la API se mueve también o sigue en Render.