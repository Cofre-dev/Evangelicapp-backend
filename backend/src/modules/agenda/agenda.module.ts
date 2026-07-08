import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { EventosController } from './eventos.controller';
import { EventosService } from './eventos.service';
import { PredicadoresController } from './predicadores.controller';
import { PredicadoresService } from './predicadores.service';

@Module({
  imports: [MailModule],
  controllers: [EventosController, PredicadoresController],
  providers: [EventosService, PredicadoresService],
})
export class AgendaModule {}
