import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanIglesia, Rol } from '@prisma/client';
import { runAsService } from '../../common/context/tenant-context';
import { DIAS_GRACIA_MORA } from '../../common/constants/facturacion';
import { calcularEstadoFacturacion } from '../../common/utils/calcular-facturacion';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { IglesiasService } from './iglesias.service';

const DIAS_AVISO_PREVENTIVO = 7;

/**
 * Recordatorios automáticos de facturación (Fase 4 de docs/supabase.md), corriendo
 * dentro del propio proceso Nest (`@nestjs/schedule`) en vez de un Edge Function
 * separado como sugería el plan original: el backend ya corre siempre activo (no
 * serverless, ver despliegue en Render), así que no hace falta exponer un endpoint
 * interno protegido ni duplicar la lógica de envío en Deno — se reutiliza
 * `MailService` directo.
 *
 * Reglas de negocio (definidas por el fundador):
 * - 7 días antes del vencimiento: un correo preventivo.
 * - Ya vencida: un correo cada 2 días (día 1, 3, 5, 7... de mora), no todos los días.
 * - Desde 2026-11-26: al cumplir DIAS_GRACIA_MORA días de mora, la iglesia baja al plan
 *   GRATUITO (IglesiasService#degradarPorMora) en vez de quedar bloqueada, con un correo
 *   al pastor. Recupera su plan cuando el SuperAdmin confirma el pago.
 * - Las iglesias en plan GRATUITO no reciben nada de esto (no pagan).
 *
 * La degradación está detrás del interruptor `MORA_PASA_A_GRATUITO` (variable de entorno,
 * apagada salvo que valga "true"): se subió el backend antes de que el frontend supiera
 * manejar el plan gratuito, y al desplegar 6 de las 7 iglesias de producción tenían más
 * de 3 días de mora. Con el interruptor apagado el cron se comporta como antes (solo
 * recordatorios). Encenderlo en Render cuando el frontend de la red esté en producción.
 *
 * Los avisos se evalúan como "es exactamente hoy" (`diasParaFacturacion === 7` /
 * `diasEnMora` impar), sin estado persistido de "ya se avisó". La degradación usa
 * `>=` (no `===`): si el cron no corre justo ese día, la degrada al día siguiente.
 */
@Injectable()
export class FacturacionRecordatoriosCron {
  private readonly logger = new Logger(FacturacionRecordatoriosCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly iglesiasService: IglesiasService,
    private readonly config: ConfigService,
  ) {}

  private get moraPasaAGratuito(): boolean {
    return this.config.get<string>('MORA_PASA_A_GRATUITO') === 'true';
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async ejecutar(): Promise<void> {
    // Fase 8 de docs/supabase.md (RLS): no hay request HTTP acá (corre por cron), así que
    // no existe contexto de tenant salvo que se abra a mano. Bypass legítimo — este job
    // necesita leer todas las iglesias a propósito, no una en particular.
    return runAsService(() => this.ejecutarComoServicio());
  }

  private async ejecutarComoServicio(): Promise<void> {
    const iglesias = await this.prisma.iglesia.findMany({
      where: { plan: { not: PlanIglesia.GRATUITO }, proximaFacturacion: { not: null } },
      select: {
        id: true,
        nombre: true,
        proximaFacturacion: true,
        usuarios: {
          where: { rol: Rol.MANAGER, activo: true },
          select: { email: true },
          take: 1,
        },
      },
    });

    let enviados = 0;
    let degradadas = 0;
    for (const iglesia of iglesias) {
      if (!iglesia.proximaFacturacion) continue;
      const manager = iglesia.usuarios[0];

      const { diasParaFacturacion, enMora, diasEnMora } = calcularEstadoFacturacion(
        iglesia.proximaFacturacion,
      );

      if (this.moraPasaAGratuito && enMora && diasEnMora >= DIAS_GRACIA_MORA) {
        if (await this.iglesiasService.degradarPorMora(iglesia.id)) {
          degradadas++;
          if (manager) {
            await this.mailService.enviarPlanDegradado({
              email: manager.email,
              nombreIglesia: iglesia.nombre,
            });
          }
        }
        continue;
      }

      // No debería pasar (toda iglesia se crea con su manager), pero una cuenta
      // desactivada a mano no debe tumbar la corrida del resto de las iglesias.
      if (!manager) continue;

      if (diasParaFacturacion === DIAS_AVISO_PREVENTIVO) {
        await this.mailService.enviarRecordatorioFacturacion({
          email: manager.email,
          nombreIglesia: iglesia.nombre,
          proximaFacturacion: iglesia.proximaFacturacion,
        });
        enviados++;
      } else if (enMora && diasEnMora % 2 === 1) {
        await this.mailService.enviarFacturacionVencida({
          email: manager.email,
          nombreIglesia: iglesia.nombre,
          diasEnMora,
          pasaAGratuito: this.moraPasaAGratuito,
        });
        enviados++;
      }
    }

    if (enviados > 0 || degradadas > 0) {
      this.logger.log(
        `Facturación: ${enviados} recordatorio(s) enviado(s), ${degradadas} iglesia(s) pasada(s) a plan gratuito por mora.`,
      );
    }
  }
}
