import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ResponderAsistenciaDto } from './dto/responder-asistencia.dto';
import { AsistenciasService } from './asistencias.service';

/**
 * Ruta pública (junto con `agenda/predicadores/:token` y `/auth/login`). Sin guards:
 * el tokenConfirmacion de un solo uso es la propia autenticación del integrante.
 */
@Controller('agenda/asistencias')
export class AsistenciasController {
  constructor(private readonly asistenciasService: AsistenciasService) {}

  @Get(':token')
  getInvitacion(@Param('token') token: string) {
    return this.asistenciasService.getInvitacion(token);
  }

  @Post(':token/responder')
  responder(@Param('token') token: string, @Body() dto: ResponderAsistenciaDto) {
    return this.asistenciasService.responder(token, dto.respuesta);
  }
}
