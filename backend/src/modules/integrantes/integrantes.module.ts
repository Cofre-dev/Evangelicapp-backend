import { Module } from '@nestjs/common';
import { IntegrantesController } from './integrantes.controller';
import { IntegrantesRegistroController } from './integrantes-registro.controller';
import { IntegrantesService } from './integrantes.service';

@Module({
  controllers: [IntegrantesController, IntegrantesRegistroController],
  providers: [IntegrantesService],
})
export class IntegrantesModule {}
