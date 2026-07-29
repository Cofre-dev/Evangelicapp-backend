import { Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMiIglesiaDto } from './dto/update-mi-iglesia.dto';

const MI_IGLESIA_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  direccion: true,
  logoUrl: true,
  estado: true,
  visitantesPromedio: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MiIglesiaService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: MI_IGLESIA_SELECT,
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    return iglesia;
  }

  /** Corrige datos ingresados mal en el alta (nombre, comuna, región, dirección). */
  async update(iglesiaId: string, dto: UpdateMiIglesiaDto) {
    await this.findOne(iglesiaId);

    return this.prisma.iglesia.update({
      where: { id: iglesiaId },
      data: {
        nombre: dto.nombre,
        comuna: dto.comuna,
        region: dto.region,
        direccion: dto.direccion,
      },
      select: MI_IGLESIA_SELECT,
    });
  }

  /** Reemplaza el logo, borrando el archivo anterior del disco si existía. */
  async updateLogo(iglesiaId: string, logo: Express.Multer.File) {
    const iglesia = await this.findOne(iglesiaId);

    if (iglesia.logoUrl) {
      const previousPath = join(process.cwd(), iglesia.logoUrl.replace(/^\//, ''));
      await unlink(previousPath).catch(() => undefined);
    }

    return this.prisma.iglesia.update({
      where: { id: iglesiaId },
      data: { logoUrl: `/uploads/logos/${logo.filename}` },
      select: MI_IGLESIA_SELECT,
    });
  }
}
