import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AsistenciasController } from './asistencias.controller';
import { AsistenciasService } from './asistencias.service';
import { EventosController } from './eventos.controller';
import { EventosService } from './eventos.service';
import { PredicadoresController } from './predicadores.controller';
import { PredicadoresService } from './predicadores.service';

@Module({
  imports: [MailModule],
  controllers: [EventosController, PredicadoresController, AsistenciasController],
  providers: [EventosService, PredicadoresService, AsistenciasService],
})
export class AgendaModule {}
