import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PredicadoresService {
  constructor(private readonly prisma: PrismaService) {}

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
    const predicador = await this.prisma.predicador.findUnique({ where: { tokenConfirmacion: token } });

    if (!predicador) {
      throw new NotFoundException('Invitación no encontrada');
    }

    await this.prisma.predicador.update({
      where: { tokenConfirmacion: token },
      data: { estado: respuesta, respondidoAt: new Date() },
    });

    return this.getInvitacion(token);
  }
}
