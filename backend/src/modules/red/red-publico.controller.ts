import { Body, Controller, HttpCode, HttpStatus, Ip, Param, Post } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { RegistroIglesiaDto } from './dto/registro-iglesia.dto';
import { RedRegistroService } from './red-registro.service';

/**
 * Registro autoservicio de iglesias (página pública "Registra tu iglesia"). Sin guards:
 * todavía no hay cuenta. Throttle estricto por IP + captcha (Turnstile) contra bots;
 * exentas de CSRF en app.module.ts, igual que las demás rutas públicas.
 */
@Controller('red/registro')
export class RedPublicoController {
  constructor(private readonly registroService: RedRegistroService) {}

  /** 202: se mandó el correo de confirmación; la iglesia todavía no existe. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  solicitar(@Body() dto: RegistroIglesiaDto, @Ip() ip: string) {
    return this.registroService.solicitar(dto, ip);
  }

  /** Link del correo: crea la iglesia GRATUITO y su pastor. Idempotente. */
  @Post('confirmar/:token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: minutes(15) } })
  confirmar(@Param('token') token: string) {
    return this.registroService.confirmar(token);
  }
}
