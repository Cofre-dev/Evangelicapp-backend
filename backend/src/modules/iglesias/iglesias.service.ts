import { Injectable, NotFoundException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { generateTemporaryPassword } from '../../common/utils/generate-temporary-password';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIglesiaDto } from './dto/create-iglesia.dto';

@Injectable()
export class IglesiasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea la iglesia y su manager (dueño del tenant) en una sola transacción —
   * una iglesia sin manager a cargo no tiene sentido en este modelo. La
   * contraseña temporal se devuelve una sola vez, igual que con el resto del equipo.
   */
  async create(dto: CreateIglesiaDto, logo?: Express.Multer.File) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    try {
      const { iglesia, pastor } = await this.prisma.$transaction(async (tx) => {
        const iglesia = await tx.iglesia.create({
          data: {
            nombre: dto.nombre,
            comuna: dto.comuna,
            region: dto.region,
            direccion: dto.direccion,
            logoUrl: logo ? `/uploads/logos/${logo.filename}` : undefined,
          },
        });

        const pastor = await tx.usuario.create({
          data: {
            username: dto.pastorUsername,
            email: dto.pastorEmail,
            password: passwordHash,
            nombre: dto.pastorNombre,
            apellido: dto.pastorApellido,
            rol: Rol.MANAGER,
            iglesiaId: iglesia.id,
            mustChangePassword: true,
            onboardingCompletado: false,
          },
          select: { id: true, username: true, email: true, nombre: true, apellido: true },
        });

        return { iglesia, pastor };
      });

      return { iglesia, pastor, temporaryPassword };
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  /** Detalle para el SuperAdmin: la iglesia, quién es el manager y el resto del equipo. */
  async findOne(id: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        comuna: true,
        region: true,
        direccion: true,
        logoUrl: true,
        estado: true,
        visitantesPromedio: true,
        createdAt: true,
        usuarios: {
          select: {
            id: true,
            username: true,
            email: true,
            nombre: true,
            apellido: true,
            rol: true,
            activo: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const { usuarios, ...iglesiaData } = iglesia;

    return {
      ...iglesiaData,
      pastor: usuarios.find((u) => u.rol === Rol.MANAGER) ?? null,
      equipo: usuarios.filter((u) => u.rol !== Rol.MANAGER),
    };
  }
}
