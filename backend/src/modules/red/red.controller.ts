import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EstadoAlianza, Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermitidoEnPlanGratuito } from '../../common/decorators/permitido-en-plan-gratuito.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  CambiarEstadoLlamadoDto,
  CreateCompromisoDto,
  CreateLlamadoDto,
  DirectorioQueryDto,
  FeedQueryDto,
  ReportarLlamadoDto,
  ResponderAlianzaDto,
  SolicitarAlianzaDto,
  UpdateLlamadoDto,
  UpdatePerfilRedDto,
} from './dto/red.dto';
import { RedAlianzasService } from './red-alianzas.service';
import { RedService } from './red.service';

/**
 * Red de iglesias (disponible desde el plan GRATUITO). Leer: MANAGER y USUARIO. Escribir
 * (perfil, llamados, apoyos, alianzas, reportes): solo MANAGER — son decisiones que
 * comprometen a la iglesia frente a otras. `iglesiaId` siempre del JWT.
 */
@Controller('red')
@PermitidoEnPlanGratuito()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
export class RedController {
  constructor(
    private readonly redService: RedService,
    private readonly alianzasService: RedAlianzasService,
  ) {}

  // Perfil y directorio --------------------------------------------------------

  @Get('perfil')
  getMiPerfil(@CurrentUser() user: JwtPayload) {
    return this.redService.getMiPerfil(this.iglesia(user));
  }

  @Patch('perfil')
  @Roles(Rol.MANAGER)
  updateMiPerfil(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePerfilRedDto) {
    return this.redService.updateMiPerfil(this.iglesia(user), dto);
  }

  @Get('iglesias')
  directorio(@CurrentUser() user: JwtPayload, @Query() query: DirectorioQueryDto) {
    return this.redService.directorio(this.iglesia(user), query);
  }

  @Get('iglesias/:iglesiaId')
  perfilDeIglesia(@CurrentUser() user: JwtPayload, @Param('iglesiaId') iglesiaId: string) {
    return this.redService.perfilDeIglesia(this.iglesia(user), iglesiaId);
  }

  // Feed y llamados ------------------------------------------------------------

  @Get('feed')
  feed(@CurrentUser() user: JwtPayload, @Query() query: FeedQueryDto) {
    return this.redService.feed(this.iglesia(user), {
      alcance: query.alcance,
      incluirCerrados: query.incluirCerrados === 'true',
      tipo: query.tipo,
      pagina: query.pagina,
    });
  }

  @Get('mis-llamados')
  misLlamados(@CurrentUser() user: JwtPayload) {
    return this.redService.misLlamados(this.iglesia(user));
  }

  @Get('mis-compromisos')
  misCompromisos(@CurrentUser() user: JwtPayload) {
    return this.redService.misCompromisos(this.iglesia(user));
  }

  @Post('llamados')
  @Roles(Rol.MANAGER)
  crearLlamado(@CurrentUser() user: JwtPayload, @Body() dto: CreateLlamadoDto) {
    return this.redService.crearLlamado(this.iglesia(user), user.sub, dto);
  }

  @Get('llamados/:id')
  getLlamado(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.redService.getLlamado(this.iglesia(user), id);
  }

  @Patch('llamados/:id')
  @Roles(Rol.MANAGER)
  actualizarLlamado(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateLlamadoDto) {
    return this.redService.actualizarLlamado(this.iglesia(user), id, dto);
  }

  @Patch('llamados/:id/estado')
  @Roles(Rol.MANAGER)
  cambiarEstado(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CambiarEstadoLlamadoDto,
  ) {
    return this.redService.cambiarEstadoLlamado(this.iglesia(user), id, dto.estado);
  }

  /** "¡Yo te ayudo!" */
  @Post('llamados/:id/compromisos')
  @Roles(Rol.MANAGER)
  comprometer(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CreateCompromisoDto) {
    return this.redService.comprometer(this.iglesia(user), user.sub, id, dto);
  }

  @Delete('compromisos/:id')
  @Roles(Rol.MANAGER)
  cancelarCompromiso(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.redService.cancelarCompromiso(this.iglesia(user), id);
  }

  @Post('llamados/:id/reportar')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.MANAGER)
  reportar(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReportarLlamadoDto) {
    return this.redService.reportar(this.iglesia(user), id, dto.motivo);
  }

  // Alianzas -------------------------------------------------------------------

  @Get('alianzas')
  alianzas(@CurrentUser() user: JwtPayload, @Query('estado') estado?: EstadoAlianza) {
    return this.alianzasService.listar(this.iglesia(user), estado);
  }

  @Post('alianzas')
  @Roles(Rol.MANAGER)
  solicitarAlianza(@CurrentUser() user: JwtPayload, @Body() dto: SolicitarAlianzaDto) {
    return this.alianzasService.solicitar(this.iglesia(user), user.sub, dto.iglesiaId, dto.mensaje);
  }

  @Post('alianzas/:id/responder')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.MANAGER)
  responderAlianza(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ResponderAlianzaDto,
  ) {
    return this.alianzasService.responder(this.iglesia(user), id, dto.aceptar);
  }

  @Delete('alianzas/:id')
  @Roles(Rol.MANAGER)
  eliminarAlianza(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.alianzasService.eliminar(this.iglesia(user), id);
  }

  private iglesia(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
