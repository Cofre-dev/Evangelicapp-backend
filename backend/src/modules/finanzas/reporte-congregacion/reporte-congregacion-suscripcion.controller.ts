import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { ReporteCongregacionService } from './reporte-congregacion.service';

/**
 * Página pública del link "Dejar de recibirlo" del correo del reporte financiero. Sin
 * guards: el token de baja es la propia autenticación (mismo criterio que
 * IntegrantesRegistroController / PredicadoresController). El correo apunta al
 * frontend, que muestra la iglesia y un botón de confirmación — nunca se da de baja con
 * un GET, porque los filtros antispam abren los links de los correos solos.
 */
@Controller('reporte-financiero/suscripcion')
@Throttle({ default: { limit: 20, ttl: minutes(1) } })
export class ReporteCongregacionSuscripcionController {
  constructor(private readonly reporteService: ReporteCongregacionService) {}

  @Get(':token')
  getSuscripcion(@Param('token') token: string) {
    return this.reporteService.getSuscripcion(token);
  }

  @Post(':token/baja')
  @HttpCode(HttpStatus.OK)
  darDeBaja(@Param('token') token: string) {
    return this.reporteService.cambiarSuscripcion(token, false);
  }

  /** Para deshacer una baja por error desde la misma página. */
  @Post(':token/reactivar')
  @HttpCode(HttpStatus.OK)
  reactivar(@Param('token') token: string) {
    return this.reporteService.cambiarSuscripcion(token, true);
  }
}
