import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TipoNotificacion } from '@prisma/client';
import { runAsService } from '../../common/context/tenant-context';
import { enLotes } from '../../common/utils/en-lotes';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';

const POR_PAGINA = 20;

export interface Aviso {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  url: string;
}

/**
 * Notificaciones de la Red de iglesias: la campana dentro del sistema (tabla
 * `notificaciones`, una fila por usuario), el aviso en vivo por realtime y, para quien
 * no lo desactivó, un correo.
 *
 * `avisarAIglesias` escribe filas de OTRAS iglesias, cosa que la policy RLS de
 * `notificaciones` (estándar por tenant) no le permite a un request normal: por eso
 * corre bajo `runAsService`, un bypass acotado a este fan-out — nunca lee nada para
 * devolverlo al usuario que lo disparó.
 */
@Injectable()
export class RedAvisosService {
  private readonly logger = new Logger(RedAvisosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Crea la notificación para todo usuario activo de cada iglesia indicada y, si `email`,
   * manda el correo en segundo plano a quienes lo tienen activado. Nunca lanza: un aviso
   * que falla no debe deshacer la acción que lo disparó (publicar, apoyar, aliarse).
   */
  async avisarAIglesias(iglesiaIds: string[], aviso: Aviso, email = true): Promise<void> {
    const ids = [...new Set(iglesiaIds)];
    if (ids.length === 0) {
      return;
    }

    try {
      // OJO: las queries de Prisma son perezosas (se ejecutan al hacer `await`). El `await`
      // tiene que quedar DENTRO del callback de runAsService; si el callback devuelve la
      // query sin esperarla, se ejecuta afuera con el contexto del request y RLS la filtra.
      const usuarios = await runAsService(async () => {
        const encontrados = await this.prisma.usuario.findMany({
          where: { iglesiaId: { in: ids }, activo: true },
          select: { id: true, iglesiaId: true, email: true, nombre: true, notificacionesRedEmail: true },
        });
        if (encontrados.length > 0) {
          await this.prisma.notificacion.createMany({
            data: encontrados.map((u) => ({ ...aviso, usuarioId: u.id, iglesiaId: u.iglesiaId as string })),
          });
        }
        return encontrados;
      });
      if (usuarios.length === 0) {
        return;
      }

      for (const iglesiaId of new Set(usuarios.map((u) => u.iglesiaId as string))) {
        this.realtimeService.emitAIglesia(iglesiaId, REALTIME_EVENTS.NOTIFICACION_NUEVA, {
          tipo: aviso.tipo,
        });
      }

      if (email) {
        const destinatarios = usuarios.filter((u) => u.notificacionesRedEmail);
        void enLotes(destinatarios, (u) =>
          this.mailService.enviarAvisoRed({ email: u.email, nombre: u.nombre, ...aviso }),
        ).catch((error: unknown) => this.logger.error('Fallo el envío de correos de la red', error));
      }
    } catch (error) {
      this.logger.error(`No se pudo crear el aviso ${aviso.tipo} para ${ids.length} iglesia(s)`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Campana del usuario (siempre filtrado por usuarioId del JWT, además de RLS).
  // ---------------------------------------------------------------------------

  async listar(usuarioId: string, soloNoLeidas: boolean, pagina = 1) {
    const where = { usuarioId, ...(soloNoLeidas ? { leidaEn: null } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          mensaje: true,
          url: true,
          leidaEn: true,
          createdAt: true,
        },
      }),
      this.prisma.notificacion.count({ where }),
    ]);
    return { items, total, pagina, porPagina: POR_PAGINA };
  }

  async contarNoLeidas(usuarioId: string) {
    return { total: await this.prisma.notificacion.count({ where: { usuarioId, leidaEn: null } }) };
  }

  async marcarLeida(usuarioId: string, id: string) {
    const { count } = await this.prisma.notificacion.updateMany({
      where: { id, usuarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    if (count === 0) {
      const existe = await this.prisma.notificacion.count({ where: { id, usuarioId } });
      if (!existe) {
        throw new NotFoundException('Notificación no encontrada');
      }
    }
    return this.contarNoLeidas(usuarioId);
  }

  async marcarTodasLeidas(usuarioId: string) {
    await this.prisma.notificacion.updateMany({
      where: { usuarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return this.contarNoLeidas(usuarioId);
  }

  async getPreferencias(usuarioId: string) {
    return this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { notificacionesRedEmail: true },
    });
  }

  async setPreferencias(usuarioId: string, notificacionesRedEmail: boolean) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { notificacionesRedEmail },
      select: { notificacionesRedEmail: true },
    });
  }
}
