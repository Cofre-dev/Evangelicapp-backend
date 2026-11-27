import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificacionesController } from './notificaciones.controller';
import { RedAlianzasService } from './red-alianzas.service';
import { RedAvisosService } from './red-avisos.service';
import { RedModeracionController } from './red-moderacion.controller';
import { RedModeracionService } from './red-moderacion.service';
import { RedPublicoController } from './red-publico.controller';
import { RedRegistroService } from './red-registro.service';
import { RedController } from './red.controller';
import { RedService } from './red.service';

/** Red de iglesias + plan GRATUITO. Ver docs/red-de-iglesias.md. */
@Module({
  imports: [MailModule, RealtimeModule],
  controllers: [RedPublicoController, RedController, NotificacionesController, RedModeracionController],
  providers: [RedService, RedAlianzasService, RedAvisosService, RedRegistroService, RedModeracionService],
})
export class RedModule {}
