import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ResponderPredicadorDto } from './dto/responder-predicador.dto';
import { PredicadoresService } from './predicadores.service';

/**
 * Única ruta pública de todo el backend (junto con /auth/login). Sin guards:
 * el tokenConfirmacion de un solo uso es la propia autenticación del predicador.
 */
@Controller('agenda/predicadores')
export class PredicadoresController {
  constructor(private readonly predicadoresService: PredicadoresService) {}

  @Get(':token')
  getInvitacion(@Param('token') token: string) {
    return this.predicadoresService.getInvitacion(token);
  }

  @Post(':token/responder')
  responder(@Param('token') token: string, @Body() dto: ResponderPredicadorDto) {
    return this.predicadoresService.responder(token, dto.respuesta);
  }
}
