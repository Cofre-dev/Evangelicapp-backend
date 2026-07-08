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
  UseGuards,
} from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateNotaDto } from './dto/create-nota.dto';
import { UpdateNotaDto } from './dto/update-nota.dto';
import { NotasService } from './notas.service';

/** Notas y recordatorios: de uso exclusivo del pastor. Tesorero/secretaria solo ven sus propias tareas asignadas. */
@Controller('notas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.PASTOR)
export class NotasController {
  constructor(private readonly notasService: NotasService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.notasService.findAll(this.requireIglesiaId(user));
  }

  @Get('mis-tareas')
  @Roles(Rol.PASTOR, Rol.TESORERO, Rol.SECRETARIA)
  findMisTareas(@CurrentUser() user: JwtPayload) {
    return this.notasService.findMisTareas(this.requireIglesiaId(user), user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateNotaDto) {
    return this.notasService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateNotaDto) {
    return this.notasService.update(this.requireIglesiaId(user), id, dto);
  }

  @Patch(':id/marcar-hecha')
  @Roles(Rol.PASTOR, Rol.TESORERO, Rol.SECRETARIA)
  marcarHecha(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notasService.marcarHecha(this.requireIglesiaId(user), user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    return this.notasService.remove(this.requireIglesiaId(user), id);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
