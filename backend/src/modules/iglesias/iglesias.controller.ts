import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Rol } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActualizarFacturacionDto } from './dto/actualizar-facturacion.dto';
import { CambiarPlanDto } from './dto/cambiar-plan.dto';
import { CreateIglesiaDto } from './dto/create-iglesia.dto';
import { IglesiasService } from './iglesias.service';
import { logoMulterOptions } from './logo-upload.config';

@Controller('iglesias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.SUPER_ADMIN)
export class IglesiasController {
  constructor(private readonly iglesiasService: IglesiasService) {}

  @Post()
  @UseInterceptors(FileInterceptor('logo', logoMulterOptions))
  create(@Body() dto: CreateIglesiaDto, @UploadedFile() logo?: Express.Multer.File) {
    return this.iglesiasService.create(dto, logo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.iglesiasService.findOne(id);
  }

  @Patch(':id/plan')
  cambiarPlan(@Param('id') id: string, @Body() dto: CambiarPlanDto) {
    return this.iglesiasService.cambiarPlan(id, dto);
  }

  @Patch(':id/facturacion')
  actualizarFacturacion(@Param('id') id: string, @Body() dto: ActualizarFacturacionDto) {
    return this.iglesiasService.actualizarFacturacion(id, dto);
  }

  @Post(':id/marcar-pagada')
  @HttpCode(HttpStatus.OK)
  marcarPagada(@Param('id') id: string) {
    return this.iglesiasService.marcarPagada(id);
  }

  @Patch(':id/ocultar')
  ocultar(@Param('id') id: string) {
    return this.iglesiasService.ocultar(id);
  }

  @Patch(':id/mostrar')
  mostrar(@Param('id') id: string) {
    return this.iglesiasService.mostrar(id);
  }
}
