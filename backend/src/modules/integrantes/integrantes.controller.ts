import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { IntegrantesService } from './integrantes.service';

@Controller('integrantes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.PASTOR, Rol.SECRETARIA)
export class IntegrantesController {
  constructor(private readonly integrantesService: IntegrantesService) {}

  // Declaradas antes de ':id' para que Nest no las confunda con ese parámetro.
  @Get('qr')
  getQr(@CurrentUser() user: JwtPayload) {
    return this.integrantesService.getQr(this.requireIglesiaId(user));
  }

  @Post('qr/regenerar')
  regenerarQr(@CurrentUser() user: JwtPayload) {
    return this.integrantesService.regenerarQr(this.requireIglesiaId(user));
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.integrantesService.findAll(this.requireIglesiaId(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    return this.integrantesService.remove(this.requireIglesiaId(user), id);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
