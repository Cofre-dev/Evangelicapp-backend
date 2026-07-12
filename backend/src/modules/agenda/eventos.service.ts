import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoEvento } from '@prisma/client';
import { generateSecureToken } from '../../common/utils/generate-secure-token';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';

@Injectable()
export class EventosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async findAll(iglesiaId: string, from?: Date, to?: Date) {
    return this.prisma.evento.findMany({
      where: {
        iglesiaId,
        ...(from && to ? { fechaInicio: { gte: from, lte: to } } : {}),
      },
      include: { predicadores: true },
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const evento = await this.prisma.evento.findFirst({
      where: { id, iglesiaId },
      include: { predicadores: true },
    });

    if (!evento) {
      throw new NotFoundException('Evento no encontrado');
    }

    return evento;
  }

  async create(iglesiaId: string, usuarioId: string, dto: CreateEventoDto) {
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);

    // Crear siempre cuenta como "agendar": la fecha de inicio nunca puede quedar en el pasado.
    this.validarFechas(fechaInicio, fechaFin, { validarNoPasado: true });

    const evento = await this.prisma.evento.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        tipo: dto.tipo,
        fechaInicio,
        fechaFin,
        ubicacion: dto.ubicacion,
        colorEtiqueta: dto.colorEtiqueta,
        iglesiaId,
        creadoPorId: usuarioId,
      },
    });

    if (dto.tipo === TipoEvento.CULTO && dto.predicadores?.length) {
      await this.invitarPredicadores(iglesiaId, evento, dto.predicadores);
    }

    return this.findOne(iglesiaId, evento.id);
  }

  async update(iglesiaId: string, id: string, dto: UpdateEventoDto) {
    const existente = await this.findOne(iglesiaId, id);

    const nuevaFechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : existente.fechaInicio;
    const nuevaFechaFin = dto.fechaFin ? new Date(dto.fechaFin) : existente.fechaFin;

    // Solo exigir "no en el pasado" si la fecha de inicio realmente está cambiando —
    // si no, editar un evento ya pasado (p.ej. corregir el título) quedaría bloqueado para siempre.
    const cambiaFechaInicio =
      dto.fechaInicio !== undefined && nuevaFechaInicio.getTime() !== existente.fechaInicio.getTime();

    this.validarFechas(nuevaFechaInicio, nuevaFechaFin, { validarNoPasado: cambiaFechaInicio });

    return this.prisma.evento.update({
      where: { id },
      data: {
        ...dto,
        fechaInicio: dto.fechaInicio ? nuevaFechaInicio : undefined,
        fechaFin: dto.fechaFin ? nuevaFechaFin : undefined,
      },
      include: { predicadores: true },
    });
  }

  private validarFechas(fechaInicio: Date, fechaFin: Date, opciones: { validarNoPasado: boolean }) {
    if (fechaFin <= fechaInicio) {
      throw new BadRequestException('La hora de término debe ser posterior a la hora de inicio');
    }

    if (opciones.validarNoPasado) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const fechaSolo = new Date(fechaInicio);
      fechaSolo.setHours(0, 0, 0, 0);

      if (fechaSolo < hoy) {
        throw new BadRequestException('No se pueden agendar eventos en fechas anteriores a hoy');
      }
    }
  }

  async remove(iglesiaId: string, id: string): Promise<void> {
    await this.findOne(iglesiaId, id);
    await this.prisma.evento.delete({ where: { id } });
  }

  private async invitarPredicadores(
    iglesiaId: string,
    evento: { id: string; titulo: string; fechaInicio: Date },
    predicadores: { email: string; nombre?: string }[],
  ) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: { nombre: true },
    });

    for (const invitado of predicadores) {
      const predicador = await this.prisma.predicador.create({
        data: {
          eventoId: evento.id,
          email: invitado.email,
          nombre: invitado.nombre,
          tokenConfirmacion: generateSecureToken(),
        },
      });

      await this.mailService.enviarInvitacionPredicador({
        email: predicador.email,
        nombreIglesia: iglesia?.nombre ?? 'tu iglesia',
        tituloEvento: evento.titulo,
        fecha: evento.fechaInicio,
        tokenConfirmacion: predicador.tokenConfirmacion,
      });
    }
  }
}
