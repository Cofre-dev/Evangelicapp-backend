import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { generateTemporaryPassword } from '../../common/utils/generate-temporary-password';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const USUARIO_SELECT = {
  id: true,
  username: true,
  email: true,
  nombre: true,
  apellido: true,
  telefono: true,
  rol: true,
  activo: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Equipo de la iglesia (Tesorero/Secretaria). El pastor se gestiona aparte, vía onboarding. */
  async findAllForIglesia(iglesiaId: string) {
    return this.prisma.usuario.findMany({
      where: { iglesiaId, rol: { not: Rol.PASTOR } },
      select: USUARIO_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(iglesiaId: string, dto: CreateUsuarioDto) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          username: dto.username,
          email: dto.email,
          password: passwordHash,
          nombre: dto.nombre,
          apellido: dto.apellido,
          telefono: dto.telefono,
          rol: dto.rol,
          iglesiaId,
          mustChangePassword: true,
          onboardingCompletado: true, // el onboarding de datos personales es exclusivo del pastor
        },
        select: USUARIO_SELECT,
      });

      return { usuario, temporaryPassword };
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  async update(iglesiaId: string, usuarioId: string, dto: UpdateUsuarioDto) {
    await this.findMiembroEquipoOrThrow(iglesiaId, usuarioId);

    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: dto,
      select: USUARIO_SELECT,
    });
  }

  /**
   * Aísla por tenant: si el usuario no pertenece a esta iglesia (o es el propio
   * PASTOR) se responde 404 en vez de 403, para no filtrar que el registro existe.
   */
  private async findMiembroEquipoOrThrow(iglesiaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, iglesiaId, rol: { not: Rol.PASTOR } },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }
}
