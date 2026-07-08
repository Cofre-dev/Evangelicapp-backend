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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Rol, TipoMovimiento } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';
import { MovimientosService } from './movimientos.service';

@Controller('finanzas/movimientos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.PASTOR, Rol.TESORERO)
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipo') tipo?: TipoMovimiento,
  ) {
    return this.movimientosService.findAll(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      tipo,
    );
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.movimientosService.dashboard(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('logs')
  logs(@CurrentUser() user: JwtPayload) {
    return this.movimientosService.logs(this.requireIglesiaId(user));
  }

  @Get('exportar')
  async exportar(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<StreamableFile> {
    const buffer = await this.movimientosService.exportar(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="movimientos.xlsx"',
    });

    return new StreamableFile(buffer);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMovimientoDto) {
    return this.movimientosService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateMovimientoDto) {
    return this.movimientosService.update(this.requireIglesiaId(user), id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmPasswordDto,
  ): Promise<void> {
    return this.movimientosService.remove(this.requireIglesiaId(user), id, user.sub, dto);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
