import { Injectable } from '@nestjs/common';
import { TipoMovimiento } from '@prisma/client';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(iglesiaId: string, tipo?: TipoMovimiento) {
    return this.prisma.categoriaFinanciera.findMany({
      where: { iglesiaId, ...(tipo ? { tipo } : {}) },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(iglesiaId: string, dto: CreateCategoriaDto) {
    try {
      return await this.prisma.categoriaFinanciera.create({
        data: { nombre: dto.nombre, tipo: dto.tipo, iglesiaId },
      });
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }
}
