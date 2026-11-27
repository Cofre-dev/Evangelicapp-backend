import { ForbiddenException } from '@nestjs/common';

/**
 * Lanzada por JwtAuthGuard cuando una iglesia en plan GRATUITO llama a una ruta de un
 * módulo de pago (ver @PermitidoEnPlanGratuito). El `code` le permite al frontend
 * distinguir este 403 de cualquier otro y mostrar la invitación a contratar un plan.
 */
export class RequierePlanPagoException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      code: 'REQUIERE_PLAN_PAGO',
      message: 'Esta función está disponible en los planes de pago.',
    });
  }
}
