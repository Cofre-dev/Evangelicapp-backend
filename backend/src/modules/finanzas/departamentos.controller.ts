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
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { DepartamentosService } from './departamentos.service';
import { CreateDepartamentoDto } from './dto/create-departamento.dto';
import { UpdateDepartamentoDto } from './dto/update-departamento.dto';

@Controller('finanzas/departamentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.PASTOR, Rol.TESORERO)
export class DepartamentosController {
  constructor(private readonly departamentosService: DepartamentosService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('incluirInactivos') incluirInactivos?: string) {
    return this.departamentosService.findAll(this.requireIglesiaId(user), incluirInactivos === 'true');
  }

  /** Solo PASTOR: los departamentos son estructura organizacional, no un movimiento operativo del día a día. */
  @Post()
  @Roles(Rol.PASTOR)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDepartamentoDto) {
    return this.departamentosService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Patch(':id')
  @Roles(Rol.PASTOR)
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDepartamentoDto) {
    return this.departamentosService.update(this.requireIglesiaId(user), id, dto);
  }

  @Delete(':id')
  @Roles(Rol.PASTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmPasswordDto,
  ): Promise<void> {
    return this.departamentosService.remove(this.requireIglesiaId(user), id, user.sub, dto);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
