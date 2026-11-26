import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { CategoriasOcultasDto } from './dto/categorias-ocultas.dto';
import { EnviarReporteDto } from './dto/enviar-reporte.dto';
import { UpdateReporteCongregacionDto } from './dto/update-reporte-congregacion.dto';
import { ReporteCongregacionService } from './reporte-congregacion.service';

/**
 * Reporte financiero a la congregación: exclusivo del MANAGER (el pastor decide qué se
 * comparte con su congregación; un USUARIO con acceso a FINANZAS no puede activarlo ni
 * enviarlo). Por eso no lleva @Modulo: el MANAGER siempre tiene todos los módulos.
 */
@Controller('finanzas/reporte-congregacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER)
export class ReporteCongregacionController {
  constructor(private readonly reporteService: ReporteCongregacionService) {}

  @Get()
  getConfiguracion(@CurrentUser() user: JwtPayload) {
    return this.reporteService.getConfiguracion(this.requireIglesiaId(user));
  }

  /** El interruptor: `{ activo: true | false }`. */
  @Patch()
  setActivo(@CurrentUser() user: JwtPayload, @Body() dto: UpdateReporteCongregacionDto) {
    return this.reporteService.setActivo(this.requireIglesiaId(user), user.sub, dto.activo);
  }

  @Put('categorias-ocultas')
  actualizarCategoriasOcultas(@CurrentUser() user: JwtPayload, @Body() dto: CategoriasOcultasDto) {
    return this.reporteService.actualizarCategoriasOcultas(this.requireIglesiaId(user), dto.categoriaIds);
  }

  @Get('vista-previa')
  vistaPrevia(@CurrentUser() user: JwtPayload, @Query() query: EnviarReporteDto) {
    return this.reporteService.vistaPrevia(this.requireIglesiaId(user), query.periodo);
  }

  /** 202: el envío queda registrado y los correos salen en segundo plano. */
  @Post('enviar')
  @HttpCode(HttpStatus.ACCEPTED)
  enviarAhora(@CurrentUser() user: JwtPayload, @Body() dto: EnviarReporteDto) {
    return this.reporteService.enviarAhora(this.requireIglesiaId(user), user.sub, dto.periodo);
  }

  @Get('envios')
  historial(@CurrentUser() user: JwtPayload) {
    return this.reporteService.historial(this.requireIglesiaId(user));
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
