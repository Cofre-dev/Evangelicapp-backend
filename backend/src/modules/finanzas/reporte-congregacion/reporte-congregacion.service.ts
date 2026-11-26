import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrigenEnvioReporte, Prisma } from '@prisma/client';
import { runAsService } from '../../../common/context/tenant-context';
import { generateSecureToken } from '../../../common/utils/generate-secure-token';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import {
  MESES_ATRAS_ENVIO_MANUAL,
  ReporteFinancieroData,
  construirReporte,
  esPeriodoEnviable,
  inicioMesActual,
  periodoAnterior,
  primerNombre,
  rangoPeriodo,
} from './reporte-congregacion.util';

/**
 * Envío por lotes para no chocar con el rate limit del proveedor de correo (Resend
 * permite pocas requests por segundo en su plan base; SMTP de Gmail también limita).
 * Con 2 correos por segundo, 300 integrantes tardan ~2,5 minutos — en segundo plano.
 */
const CORREOS_POR_LOTE = 2;
const PAUSA_ENTRE_LOTES_MS = 1000;

const SELECT_ENVIO = {
  id: true,
  periodo: true,
  origen: true,
  destinatarios: true,
  enviados: true,
  fallidos: true,
  completadoEn: true,
  createdAt: true,
  enviadoPor: { select: { nombre: true, apellido: true } },
} satisfies Prisma.EnvioReporteFinancieroSelect;

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Destinatario {
  id: string;
  email: string;
  nombreCompleto: string;
  tokenBajaReporte: string | null;
}

/**
 * Reporte financiero mensual que el pastor decide compartir con su congregación
 * (docs/pendientes-producto.md, feature 1).
 *
 * Reglas:
 * - Voluntario: el interruptor nace apagado y solo lo cambia el MANAGER.
 * - Solo a integrantes con consentimiento explícito (`aceptaReporteFinanciero`), con link
 *   de baja en cada correo.
 * - Solo totales por categoría (ver ReporteFinancieroData); las categorías marcadas como
 *   ocultas se suman en "Otros".
 * - Un mes se envía una sola vez por iglesia (`@@unique([iglesiaId, periodo])`), ya sea
 *   por el cron (ReporteCongregacionCron) o con "Enviar ahora".
 *
 * `iglesiaId` siempre viene del JWT (controller) o de la propia fila de iglesia (cron).
 */
@Injectable()
export class ReporteCongregacionService {
  private readonly logger = new Logger(ReporteCongregacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /** Pantalla de configuración del pastor: estado del interruptor, destinatarios y categorías. */
  async getConfiguracion(iglesiaId: string) {
    const ahora = new Date();
    const [iglesia, totalIntegrantes, aceptan, categorias, ultimoEnvio] = await Promise.all([
      this.prisma.iglesia.findUnique({
        where: { id: iglesiaId },
        select: {
          reporteFinancieroActivo: true,
          reporteFinancieroActivadoEn: true,
          reporteFinancieroActivadoPor: { select: { nombre: true, apellido: true } },
        },
      }),
      this.prisma.integrante.count({ where: { iglesiaId } }),
      this.prisma.integrante.count({ where: { iglesiaId, aceptaReporteFinanciero: true } }),
      this.prisma.categoriaFinanciera.findMany({
        where: { iglesiaId },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          ocultaEnReporte: true,
          departamento: { select: { id: true, nombre: true } },
        },
        orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.envioReporteFinanciero.findFirst({
        where: { iglesiaId },
        orderBy: { createdAt: 'desc' },
        select: SELECT_ENVIO,
      }),
    ]);

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    return {
      activo: iglesia.reporteFinancieroActivo,
      activadoEn: iglesia.reporteFinancieroActivadoEn,
      activadoPor: iglesia.reporteFinancieroActivadoPor,
      destinatarios: { aceptan, totalIntegrantes },
      // Siempre el día 1 del mes siguiente: si se enciende hoy, el reporte del mes en
      // curso sale el 1 del próximo mes (el del mes pasado se puede mandar a mano).
      proximoEnvioAutomatico: iglesia.reporteFinancieroActivo
        ? new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1))
        : null,
      periodoSugerido: periodoAnterior(ahora),
      mesesAtrasPermitidos: MESES_ATRAS_ENVIO_MANUAL,
      categorias,
      ultimoEnvio,
    };
  }

  async setActivo(iglesiaId: string, usuarioId: string, activo: boolean) {
    await this.prisma.iglesia.update({
      where: { id: iglesiaId },
      // Al apagar se conserva quién y cuándo lo encendió por última vez (trazabilidad).
      data: activo
        ? {
            reporteFinancieroActivo: true,
            reporteFinancieroActivadoEn: new Date(),
            reporteFinancieroActivadoPorId: usuarioId,
          }
        : { reporteFinancieroActivo: false },
    });
    return this.getConfiguracion(iglesiaId);
  }

  async actualizarCategoriasOcultas(iglesiaId: string, categoriaIds: string[]) {
    const ids = [...new Set(categoriaIds)];
    // Nunca confiar en ids del cliente: todas tienen que ser de esta iglesia.
    const propias = await this.prisma.categoriaFinanciera.count({
      where: { iglesiaId, id: { in: ids } },
    });
    if (propias !== ids.length) {
      throw new BadRequestException('Alguna categoría no existe o no pertenece a tu iglesia');
    }

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.categoriaFinanciera.updateMany({
        where: { iglesiaId, ocultaEnReporte: true, id: { notIn: ids } },
        data: { ocultaEnReporte: false },
      });
      if (ids.length > 0) {
        await tx.categoriaFinanciera.updateMany({
          where: { iglesiaId, id: { in: ids } },
          data: { ocultaEnReporte: true },
        });
      }
    });

    return this.getConfiguracion(iglesiaId);
  }

  /** Lo que el pastor ve antes de activar o enviar: los números y el HTML exacto del correo. */
  async vistaPrevia(iglesiaId: string, periodoSolicitado?: string) {
    const periodo = this.periodoEnviableOrThrow(periodoSolicitado);
    const [iglesia, reporte, destinatarios, envioExistente] = await Promise.all([
      this.iglesiaOrThrow(iglesiaId),
      this.calcularReporte(iglesiaId, periodo),
      this.prisma.integrante.count({ where: { iglesiaId, aceptaReporteFinanciero: true } }),
      this.prisma.envioReporteFinanciero.findUnique({
        where: { iglesiaId_periodo: { iglesiaId, periodo } },
        select: SELECT_ENVIO,
      }),
    ]);

    const correo = this.mailService.renderReporteFinanciero({
      nombreIglesia: iglesia.nombre,
      logoUrl: iglesia.logoUrl,
      nombreDestinatario: 'María',
      reporte,
      tokenBaja: null,
    });

    return { periodo, reporte, destinatarios, envioExistente, asunto: correo.asunto, html: correo.html };
  }

  /**
   * "Enviar ahora": no depende del interruptor (es una acción explícita del pastor).
   * Responde apenas queda registrado el envío; los correos salen en segundo plano y el
   * historial se completa con enviados/fallidos al terminar.
   */
  async enviarAhora(iglesiaId: string, usuarioId: string, periodoSolicitado?: string) {
    const periodo = this.periodoEnviableOrThrow(periodoSolicitado);
    const resultado = await this.registrarEnvio(iglesiaId, periodo, OrigenEnvioReporte.MANUAL, usuarioId);

    if (resultado.estado === 'SIN_DESTINATARIOS') {
      throw new BadRequestException(
        'Ningún integrante ha aceptado recibir el reporte todavía. Lo pueden aceptar desde el formulario del QR.',
      );
    }
    if (resultado.estado === 'YA_ENVIADO') {
      throw new ConflictException('El reporte de ese mes ya se envió a la congregación');
    }

    void resultado.enviar().catch((error: unknown) => {
      this.logger.error(`Fallo el envío manual del reporte ${periodo} de la iglesia ${iglesiaId}`, error);
    });

    return this.prisma.envioReporteFinanciero.findUniqueOrThrow({
      where: { id: resultado.envioId },
      select: SELECT_ENVIO,
    });
  }

  async historial(iglesiaId: string) {
    return this.prisma.envioReporteFinanciero.findMany({
      where: { iglesiaId },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: { ...SELECT_ENVIO, snapshot: true },
    });
  }

  /**
   * Usado por el cron (bajo `runAsService`). Si no hay destinatarios todavía o el mes ya
   * se envió, no hace nada (el cron vuelve a intentar los días siguientes dentro de su
   * ventana). Espera a que terminen los correos antes de seguir con la próxima iglesia.
   */
  async enviarAutomatico(iglesiaId: string, periodo: string): Promise<boolean> {
    const resultado = await this.registrarEnvio(iglesiaId, periodo, OrigenEnvioReporte.AUTOMATICO, null);
    if (resultado.estado !== 'REGISTRADO') {
      return false;
    }
    await resultado.enviar();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Suscripción pública (link del correo). Sin identidad de Usuario: el token de baja
  // es la autorización, igual que las otras rutas públicas por token (ver runAsService).
  // ---------------------------------------------------------------------------

  async getSuscripcion(token: string) {
    return runAsService(async () => {
      const integrante = await this.integrantePorTokenOrThrow(token);
      return {
        nombreIglesia: integrante.iglesia.nombre,
        logoUrl: integrante.iglesia.logoUrl,
        suscrito: integrante.aceptaReporteFinanciero,
      };
    });
  }

  async cambiarSuscripcion(token: string, suscrito: boolean) {
    return runAsService(async () => {
      const integrante = await this.integrantePorTokenOrThrow(token);
      // Idempotente: repetir la baja (o la reactivación) no cambia nada ni falla.
      if (integrante.aceptaReporteFinanciero !== suscrito) {
        await this.prisma.integrante.update({
          where: { id: integrante.id },
          data: {
            aceptaReporteFinanciero: suscrito,
            ...(suscrito ? { aceptaReporteFinancieroEn: new Date() } : {}),
          },
        });
      }
      return {
        nombreIglesia: integrante.iglesia.nombre,
        logoUrl: integrante.iglesia.logoUrl,
        suscrito,
      };
    });
  }

  private async integrantePorTokenOrThrow(token: string) {
    const integrante = await this.prisma.integrante.findUnique({
      where: { tokenBajaReporte: token },
      select: {
        id: true,
        aceptaReporteFinanciero: true,
        iglesia: { select: { nombre: true, logoUrl: true } },
      },
    });
    if (!integrante) {
      throw new NotFoundException('Enlace no válido');
    }
    return integrante;
  }

  // ---------------------------------------------------------------------------

  /**
   * Paso 1 de todo envío: calcula el reporte, congela el snapshot y "reclama" el mes
   * insertando la fila de EnvioReporteFinanciero. El unique (iglesiaId, periodo) hace que
   * de dos intentos simultáneos (doble clic, cron + manual) solo uno gane. Devuelve una
   * función `enviar` para el paso 2 (los correos), que el llamador decide si espera o no.
   */
  private async registrarEnvio(
    iglesiaId: string,
    periodo: string,
    origen: OrigenEnvioReporte,
    usuarioId: string | null,
  ): Promise<
    | { estado: 'SIN_DESTINATARIOS' }
    | { estado: 'YA_ENVIADO' }
    | { estado: 'REGISTRADO'; envioId: string; enviar: () => Promise<void> }
  > {
    const [iglesia, reporte, destinatarios] = await Promise.all([
      this.iglesiaOrThrow(iglesiaId),
      this.calcularReporte(iglesiaId, periodo),
      this.prisma.integrante.findMany({
        where: { iglesiaId, aceptaReporteFinanciero: true },
        select: { id: true, email: true, nombreCompleto: true, tokenBajaReporte: true },
      }),
    ]);

    if (destinatarios.length === 0) {
      return { estado: 'SIN_DESTINATARIOS' };
    }

    let envioId: string;
    try {
      const envio = await this.prisma.envioReporteFinanciero.create({
        data: {
          iglesiaId,
          periodo,
          origen,
          destinatarios: destinatarios.length,
          snapshot: reporte as unknown as Prisma.InputJsonValue,
          enviadoPorId: usuarioId,
        },
        select: { id: true },
      });
      envioId = envio.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { estado: 'YA_ENVIADO' };
      }
      throw error;
    }

    return {
      estado: 'REGISTRADO',
      envioId,
      enviar: () => this.enviarCorreos(envioId, iglesia, reporte, destinatarios),
    };
  }

  private async enviarCorreos(
    envioId: string,
    iglesia: { nombre: string; logoUrl: string | null },
    reporte: ReporteFinancieroData,
    destinatarios: Destinatario[],
  ): Promise<void> {
    let enviados = 0;
    let fallidos = 0;

    for (let i = 0; i < destinatarios.length; i += CORREOS_POR_LOTE) {
      const lote = destinatarios.slice(i, i + CORREOS_POR_LOTE);
      const resultados = await Promise.all(
        lote.map(async (destinatario) => {
          const tokenBaja = await this.tokenBajaDe(destinatario);
          const correo = this.mailService.renderReporteFinanciero({
            nombreIglesia: iglesia.nombre,
            logoUrl: iglesia.logoUrl,
            nombreDestinatario: primerNombre(destinatario.nombreCompleto),
            reporte,
            tokenBaja,
          });
          return this.mailService.enviarReporteFinanciero(destinatario.email, correo);
        }),
      );
      enviados += resultados.filter(Boolean).length;
      fallidos += resultados.filter((ok) => !ok).length;

      if (i + CORREOS_POR_LOTE < destinatarios.length) {
        await esperar(PAUSA_ENTRE_LOTES_MS);
      }
    }

    await this.prisma.envioReporteFinanciero.update({
      where: { id: envioId },
      data: { enviados, fallidos, completadoEn: new Date() },
    });
    this.logger.log(`Reporte financiero ${reporte.periodo}: ${enviados} enviado(s), ${fallidos} fallido(s).`);
  }

  /** El token de baja se crea perezosamente la primera vez que a alguien se le envía un reporte. */
  private async tokenBajaDe(destinatario: Destinatario): Promise<string> {
    if (destinatario.tokenBajaReporte) {
      return destinatario.tokenBajaReporte;
    }
    const token = generateSecureToken();
    await this.prisma.integrante.update({
      where: { id: destinatario.id },
      data: { tokenBajaReporte: token },
    });
    return token;
  }

  private async calcularReporte(iglesiaId: string, periodo: string): Promise<ReporteFinancieroData> {
    const { desde, hasta } = rangoPeriodo(periodo);
    const sumas = await this.prisma.movimientoFinanciero.groupBy({
      by: ['categoriaId', 'tipo'],
      where: { iglesiaId, fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
    });

    const categorias = await this.prisma.categoriaFinanciera.findMany({
      where: { iglesiaId, id: { in: sumas.map((s) => s.categoriaId) } },
      select: { id: true, nombre: true, ocultaEnReporte: true },
    });
    const porId = new Map(categorias.map((c) => [c.id, c]));

    return construirReporte(
      periodo,
      sumas.map((suma) => {
        const categoria = porId.get(suma.categoriaId);
        return {
          tipo: suma.tipo,
          // Sin categoría encontrada no debería pasar (FK); por las dudas va a "Otros".
          categoria: categoria?.nombre ?? '',
          ocultaEnReporte: categoria?.ocultaEnReporte ?? true,
          total: Number(suma._sum.monto ?? 0),
        };
      }),
    );
  }

  private periodoEnviableOrThrow(periodoSolicitado?: string): string {
    const periodo = periodoSolicitado ?? periodoAnterior();
    if (!esPeriodoEnviable(periodo)) {
      throw new BadRequestException(
        `Solo se puede enviar un mes ya cerrado de los últimos ${MESES_ATRAS_ENVIO_MANUAL} meses`,
      );
    }
    return periodo;
  }

  private async iglesiaOrThrow(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: { nombre: true, logoUrl: true },
    });
    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }
    return iglesia;
  }
}

/** Para el cron: el interruptor tenía que estar encendido antes de que empezara el mes en curso. */
export function activadoAntesDelMesActual(activadoEn: Date | null, ahora: Date = new Date()): boolean {
  return activadoEn !== null && activadoEn < inicioMesActual(ahora);
}
