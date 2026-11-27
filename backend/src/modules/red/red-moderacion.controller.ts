import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ModerarLlamadoDto } from './dto/red.dto';
import { RedModeracionService } from './red-moderacion.service';

/**
 * Moderación de la Red de iglesias (solo SUPER_ADMIN). La verificación de iglesias va
 * por IglesiasController (`PATCH /iglesias/:id/verificacion`, cola con
 * `GET /iglesias?verificada=false&origen=AUTOSERVICIO`).
 */
@Controller('red/moderacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.SUPER_ADMIN)
export class RedModeracionController {
  constructor(private readonly moderacion: RedModeracionService) {}

  @Get('reportes')
  reportes(@Query('pendientes') pendientes?: string) {
    return this.moderacion.reportes(pendientes !== 'false');
  }

  @Patch('reportes/:id/revisado')
  marcarRevisado(@Param('id') id: string) {
    return this.moderacion.marcarRevisado(id);
  }

  /** `{ oculto: true }` saca el llamado del feed de todas las demás iglesias. */
  @Patch('llamados/:id')
  moderarLlamado(@Param('id') id: string, @Body() dto: ModerarLlamadoDto) {
    return this.moderacion.moderarLlamado(id, dto.oculto);
  }
}
