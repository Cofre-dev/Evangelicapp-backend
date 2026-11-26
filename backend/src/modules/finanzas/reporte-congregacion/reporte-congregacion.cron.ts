import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EstadoIglesia } from '@prisma/client';
import { runAsService } from '../../../common/context/tenant-context';
import { PrismaService } from '../../../prisma/prisma.service';
import { activadoAntesDelMesActual, ReporteCongregacionService } from './reporte-congregacion.service';
import { periodoAnterior } from './reporte-congregacion.util';

/**
 * Último día del mes en que el cron todavía intenta mandar el reporte del mes anterior.
 * El reporte "toca" el día 1, pero si ese día el servicio estaba caído o en redeploy (o
 * nadie había aceptado todavía), se reintenta los días siguientes. El unique
 * (iglesiaId, periodo) garantiza que nunca salga dos veces.
 */
const ULTIMO_DIA_VENTANA = 7;

/**
 * Envío automático mensual del reporte financiero a la congregación. Mismo patrón que
 * FacturacionRecordatoriosCron: corre dentro del proceso Nest (`@nestjs/schedule`).
 * A diferencia de ese cron, este sí guarda estado (EnvioReporteFinanciero), porque un
 * reporte perdido no es un aviso de cortesía: es algo que el pastor prometió enviar.
 */
@Injectable()
export class ReporteCongregacionCron {
  private readonly logger = new Logger(ReporteCongregacionCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reporteService: ReporteCongregacionService,
  ) {}

  @Cron('0 10 * * *', { timeZone: 'America/Santiago' })
  async ejecutar(): Promise<void> {
    // Fase 8 de docs/supabase.md (RLS): sin request HTTP no hay contexto de tenant. Bypass
    // legítimo y acotado — este job recorre todas las iglesias con el interruptor encendido.
    return runAsService(() => this.ejecutarComoServicio());
  }

  private async ejecutarComoServicio(ahora: Date = new Date()): Promise<void> {
    if (ahora.getUTCDate() > ULTIMO_DIA_VENTANA) {
      return;
    }

    const periodo = periodoAnterior(ahora);
    const iglesias = await this.prisma.iglesia.findMany({
      where: {
        estado: EstadoIglesia.ACTIVA,
        reporteFinancieroActivo: true,
        enviosReporteFinanciero: { none: { periodo } },
      },
      select: { id: true, reporteFinancieroActivadoEn: true },
    });

    let enviadas = 0;
    for (const iglesia of iglesias) {
      // Encender el interruptor a mitad del mes en curso no dispara solo el reporte del
      // mes pasado (ese lo puede mandar el pastor a mano con "Enviar ahora").
      if (!activadoAntesDelMesActual(iglesia.reporteFinancieroActivadoEn, ahora)) {
        continue;
      }
      try {
        if (await this.reporteService.enviarAutomatico(iglesia.id, periodo)) {
          enviadas++;
        }
      } catch (error) {
        // Una iglesia con problemas no debe frenar el envío del resto.
        this.logger.error(`No se pudo enviar el reporte ${periodo} de la iglesia ${iglesia.id}`, error);
      }
    }

    if (enviadas > 0) {
      this.logger.log(`Reporte financiero ${periodo}: enviado para ${enviadas} iglesia(s).`);
    }
  }
}
