import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermitidoEnPlanGratuito } from '../../common/decorators/permitido-en-plan-gratuito.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { NotificacionesQueryDto, PreferenciasNotificacionesDto } from './dto/red.dto';
import { RedAvisosService } from './red-avisos.service';

/** Campana de notificaciones del usuario logueado (siempre las suyas: `usuarioId` del JWT). */
@Controller('notificaciones')
@PermitidoEnPlanGratuito()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
export class NotificacionesController {
  constructor(private readonly avisos: RedAvisosService) {}

  @Get()
  listar(@CurrentUser() user: JwtPayload, @Query() query: NotificacionesQueryDto) {
    return this.avisos.listar(user.sub, query.soloNoLeidas === 'true', query.pagina);
  }

  @Get('no-leidas')
  noLeidas(@CurrentUser() user: JwtPayload) {
    return this.avisos.contarNoLeidas(user.sub);
  }

  @Post('leer-todas')
  @HttpCode(HttpStatus.OK)
  leerTodas(@CurrentUser() user: JwtPayload) {
    return this.avisos.marcarTodasLeidas(user.sub);
  }

  @Post(':id/leer')
  @HttpCode(HttpStatus.OK)
  leer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.avisos.marcarLeida(user.sub, id);
  }

  @Get('preferencias')
  preferencias(@CurrentUser() user: JwtPayload) {
    return this.avisos.getPreferencias(user.sub);
  }

  @Patch('preferencias')
  setPreferencias(@CurrentUser() user: JwtPayload, @Body() dto: PreferenciasNotificacionesDto) {
    return this.avisos.setPreferencias(user.sub, dto.notificacionesRedEmail);
  }
}
