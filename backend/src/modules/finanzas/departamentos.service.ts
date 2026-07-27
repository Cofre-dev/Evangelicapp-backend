import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateDepartamentoDto } from './dto/create-departamento.dto';
import { UpdateDepartamentoDto } from './dto/update-departamento.dto';

@Injectable()
export class DepartamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(iglesiaId: string, incluirInactivos: boolean) {
    return this.prisma.departamentoFinanciero.findMany({
      where: { iglesiaId, ...(incluirInactivos ? {} : { activo: true }) },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const departamento = await this.prisma.departamentoFinanciero.findFirst({ where: { id, iglesiaId } });

    if (!departamento) {
      throw new NotFoundException('Departamento no encontrado');
    }

    return departamento;
  }

  async create(iglesiaId: string, usuarioId: string, dto: CreateDepartamentoDto) {
    try {
      return await this.prisma.departamentoFinanciero.create({
        data: { nombre: dto.nombre, iglesiaId, creadoPorId: usuarioId },
      });
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  async update(iglesiaId: string, id: string, dto: UpdateDepartamentoDto) {
    await this.findOne(iglesiaId, id);

    try {
      return await this.prisma.departamentoFinanciero.update({
        where: { id },
        data: { nombre: dto.nombre, activo: dto.activo },
      });
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  /** Exige confirmar la contraseña del usuario antes de eliminar: es una acción irreversible. */
  async remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void> {
    await this.authService.verifyPassword(usuarioId, dto.password);

    const departamento = await this.findOne(iglesiaId, id);

    // Primera línea de defensa (mensaje claro para el usuario); el onDelete: Restrict
    // del FK en movimientos_financieros es la segunda, a nivel de DB.
    const tieneMovimientos = await this.prisma.movimientoFinanciero.count({
      where: { departamentoId: departamento.id },
    });
    if (tieneMovimientos > 0) {
      throw new ConflictException(
        'Este departamento tiene movimientos registrados y no se puede eliminar. Archívalo en su lugar.',
      );
    }

    await this.prisma.departamentoFinanciero.delete({ where: { id: departamento.id } });
  }
}
