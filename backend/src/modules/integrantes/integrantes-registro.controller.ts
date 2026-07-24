import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RegistrarIntegranteDto } from './dto/registrar-integrante.dto';
import { integranteFotoMulterOptions } from './foto-upload.config';
import { IntegrantesService } from './integrantes.service';

/**
 * Landing pública del QR de la iglesia (censo de integrantes). Sin guards:
 * el qrToken de la URL es la propia autenticación, igual que
 * PredicadoresController con su tokenConfirmacion.
 */
@Controller('integrantes/registro')
export class IntegrantesRegistroController {
  constructor(private readonly integrantesService: IntegrantesService) {}

  @Get(':qrToken')
  getInvitacion(@Param('qrToken') qrToken: string) {
    return this.integrantesService.getInvitacion(qrToken);
  }

  @Post(':qrToken')
  @UseInterceptors(FileInterceptor('foto', integranteFotoMulterOptions))
  registrar(
    @Param('qrToken') qrToken: string,
    @Body() dto: RegistrarIntegranteDto,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.integrantesService.registrar(qrToken, dto, foto);
  }
}
