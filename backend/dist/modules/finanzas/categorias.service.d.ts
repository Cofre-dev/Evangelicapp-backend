import { TipoMovimiento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
export declare class CategoriasService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(iglesiaId: string, tipo?: TipoMovimiento): Promise<{
        nombre: string;
        tipo: import(".prisma/client").$Enums.TipoMovimiento;
        id: string;
        createdAt: Date;
        iglesiaId: string;
    }[]>;
    create(iglesiaId: string, dto: CreateCategoriaDto): Promise<{
        nombre: string;
        tipo: import(".prisma/client").$Enums.TipoMovimiento;
        id: string;
        createdAt: Date;
        iglesiaId: string;
    }>;
}
