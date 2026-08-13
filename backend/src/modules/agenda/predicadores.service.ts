import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoConfirmacionPredicador } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class PredicadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /** Público: lo que ve el predicador al abrir el link del email. */
  async getInvitacion(token: string) {
    const predicador = await this.prisma.predicador.findUnique({
      where: { tokenConfirmacion: token },
      include: {
        evento: {
          select: {
            titulo: true,
            fechaInicio: true,
            fechaFin: true,
            ubicacion: true,
            iglesia: { select: { nombre: true, logoUrl: true } },
          },
        },
      },
    });

    if (!predicador) {
      throw new NotFoundException('Invitación no encontrada');
    }

    return {
      nombre: predicador.nombre,
      email: predicador.email,
      estado: predicador.estado,
      respondidoAt: predicador.respondidoAt,
      evento: {
        titulo: predicador.evento.titulo,
        fechaInicio: predicador.evento.fechaInicio,
        fechaFin: predicador.evento.fechaFin,
        ubicacion: predicador.evento.ubicacion,
      },
      iglesia: predicador.evento.iglesia,
    };
  }

  async responder(token: string, respuesta: 'CONFIRMADO' | 'RECHAZADO') {
    const predicador = await this.prisma.predicador.findUnique({
      where: { tokenConfirmacion: token },
      include: { evento: { select: { iglesiaId: true } } },
    });

    if (!predicador) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // El link es de un solo uso: sin esto, cualquiera con el link podría alternar
    // CONFIRMADO/RECHAZADO indefinidamente después de la primera respuesta.
    if (predicador.estado !== EstadoConfirmacionPredicador.PENDIENTE) {
      throw new BadRequestException('Esta invitación ya fue respondida');
    }

    const respondidoAt = new Date();
    await this.prisma.predicador.update({
      where: { tokenConfirmacion: token },
      data: { estado: respuesta, respondidoAt },
    });

    // Fase 5 de docs/supabase.md: la pantalla de evento del Pastor se entera en
    // vivo, sin refrescar, de que un predicador confirmó/rechazó.
    this.realtimeService.emitAIglesia(predicador.evento.iglesiaId, REALTIME_EVENTS.PREDICADOR_RESPONDIO, {
      eventoId: predicador.eventoId,
      predicadorId: predicador.id,
      nombre: predicador.nombre,
      email: predicador.email,
      estado: respuesta,
      respondidoAt,
    });

    return this.getInvitacion(token);
  }
}
