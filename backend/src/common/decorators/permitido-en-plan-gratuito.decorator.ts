import { SetMetadata } from '@nestjs/common';

export const PERMITIDO_EN_PLAN_GRATUITO_KEY = 'permitidoEnPlanGratuito';

/**
 * Marca un controller (o un handler) como usable por una iglesia en plan GRATUITO.
 *
 * El default es al revés a propósito (default-deny): JwtAuthGuard rechaza con
 * `RequierePlanPagoException` toda ruta autenticada de una iglesia GRATUITO que NO lleve
 * este decorador. Así, un módulo nuevo nace "de pago" sin que nadie tenga que acordarse
 * de bloquearlo. Hoy lo llevan: la Red de iglesias, notificaciones, auth (perfil propio,
 * logout, contraseña), onboarding, mi-iglesia y el token de realtime.
 */
export const PermitidoEnPlanGratuito = () => SetMetadata(PERMITIDO_EN_PLAN_GRATUITO_KEY, true);
