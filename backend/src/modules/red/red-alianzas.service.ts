import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoAlianza, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedAvisosService } from './red-avisos.service';

/**
 * Alianzas entre iglesias (la "amistad" de la red). Habilitan los llamados con
 * visibilidad ALIADAS. RLS deja ver y tocar solo las alianzas donde la iglesia es una de
 * las dos partes; acá además se valida quién puede hacer qué (solo la receptora responde).
 */
@Injectable()
export class RedAlianzasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: RedAvisosService,
  ) {}

  async listar(iglesiaId: string, estado?: EstadoAlianza) {
    const alianzas = await this.prisma.alianza.findMany({
      where: {
        OR: [{ solicitanteId: iglesiaId }, { receptoraId: iglesiaId }],
        ...(estado ? { estado } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        estado: true,
        mensaje: true,
        respondidaEn: true,
        createdAt: true,
        solicitanteId: true,
        receptoraId: true,
      },
    });

    const otras = alianzas.map((a) => (a.solicitanteId === iglesiaId ? a.receptoraId : a.solicitanteId));
    const perfiles = await this.prisma.perfilRed.findMany({
      where: { iglesiaId: { in: otras } },
      select: { iglesiaId: true, nombre: true, comuna: true, region: true, logoUrl: true, verificada: true },
    });
    const porId = new Map(perfiles.map((p) => [p.iglesiaId, p]));

    return alianzas.map(({ solicitanteId, receptoraId, ...a }) => {
      const otraId = solicitanteId === iglesiaId ? receptoraId : solicitanteId;
      return {
        ...a,
        direccion: solicitanteId === iglesiaId ? ('ENVIADA' as const) : ('RECIBIDA' as const),
        iglesia: porId.get(otraId) ?? null,
      };
    });
  }

  async solicitar(iglesiaId: string, usuarioId: string, otraIglesiaId: string, mensaje?: string) {
    if (otraIglesiaId === iglesiaId) {
      throw new BadRequestException('No puedes aliarte con tu propia iglesia');
    }
    const otra = await this.prisma.perfilRed.findUnique({
      where: { iglesiaId: otraIglesiaId },
      select: { iglesiaId: true },
    });
    if (!otra) {
      throw new NotFoundException('Iglesia no encontrada en la red');
    }

    const existente = await this.prisma.alianza.findFirst({
      where: {
        OR: [
          { solicitanteId: iglesiaId, receptoraId: otraIglesiaId },
          { solicitanteId: otraIglesiaId, receptoraId: iglesiaId },
        ],
      },
    });

    if (existente?.estado === EstadoAlianza.ACEPTADA) {
      throw new ConflictException('Ya son iglesias aliadas');
    }
    if (existente?.estado === EstadoAlianza.PENDIENTE) {
      if (existente.solicitanteId === iglesiaId) {
        throw new ConflictException('Ya enviaste una solicitud a esta iglesia');
      }
      // La otra ya te la había pedido: pedirla de vuelta es aceptarla.
      return this.responder(iglesiaId, existente.id, true);
    }

    const alianza = existente
      ? // Rechazada antes (en cualquier dirección): se reutiliza la fila como solicitud nueva.
        await this.prisma.alianza.update({
          where: { id: existente.id },
          data: {
            solicitanteId: iglesiaId,
            receptoraId: otraIglesiaId,
            estado: EstadoAlianza.PENDIENTE,
            mensaje: mensaje ?? null,
            respondidaEn: null,
            creadoPorId: usuarioId,
          },
        })
      : await this.prisma.alianza.create({
          data: { solicitanteId: iglesiaId, receptoraId: otraIglesiaId, mensaje, creadoPorId: usuarioId },
        });

    const yo = await this.nombreIglesia(iglesiaId);
    void this.avisos.avisarAIglesias([otraIglesiaId], {
      tipo: TipoNotificacion.ALIANZA_SOLICITADA,
      titulo: `${yo} quiere aliarse con tu iglesia`,
      mensaje: mensaje
        ? `${yo} te envió una solicitud de alianza: "${mensaje}"`
        : `${yo} te envió una solicitud de alianza.`,
      url: '/red/alianzas',
    });

    return alianza;
  }

  async responder(iglesiaId: string, alianzaId: string, aceptar: boolean) {
    const alianza = await this.prisma.alianza.findFirst({ where: { id: alianzaId, receptoraId: iglesiaId } });
    if (!alianza) {
      throw new NotFoundException('Solicitud de alianza no encontrada');
    }
    if (alianza.estado !== EstadoAlianza.PENDIENTE) {
      throw new ConflictException('Esta solicitud ya fue respondida');
    }

    const actualizada = await this.prisma.alianza.update({
      where: { id: alianzaId },
      data: { estado: aceptar ? EstadoAlianza.ACEPTADA : EstadoAlianza.RECHAZADA, respondidaEn: new Date() },
    });

    if (aceptar) {
      const yo = await this.nombreIglesia(iglesiaId);
      void this.avisos.avisarAIglesias([alianza.solicitanteId], {
        tipo: TipoNotificacion.ALIANZA_ACEPTADA,
        titulo: `${yo} aceptó tu alianza`,
        mensaje: `${yo} y tu iglesia ahora son aliadas en la red.`,
        url: '/red/alianzas',
      });
    }
    return actualizada;
  }

  /** Cualquiera de las dos partes puede terminar la alianza o retirar una solicitud. */
  async eliminar(iglesiaId: string, alianzaId: string) {
    const { count } = await this.prisma.alianza.deleteMany({
      where: { id: alianzaId, OR: [{ solicitanteId: iglesiaId }, { receptoraId: iglesiaId }] },
    });
    if (count === 0) {
      throw new NotFoundException('Alianza no encontrada');
    }
    return { ok: true };
  }

  private async nombreIglesia(iglesiaId: string): Promise<string> {
    const perfil = await this.prisma.perfilRed.findUnique({ where: { iglesiaId }, select: { nombre: true } });
    return perfil?.nombre ?? 'Una iglesia';
  }
}
