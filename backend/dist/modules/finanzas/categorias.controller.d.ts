import { TipoMovimiento } from '@prisma/client';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
export declare class CategoriasController {
    private readonly categoriasService;
    constructor(categoriasService: CategoriasService);
    findAll(user: JwtPayload, tipo?: TipoMovimiento): Promise<{
        nombre: string;
        tipo: import(".prisma/client").$Enums.TipoMovimiento;
        id: string;
        createdAt: Date;
        iglesiaId: string;
    }[]>;
    create(user: JwtPayload, dto: CreateCategoriaDto): Promise<{
        nombre: string;
        tipo: import(".prisma/client").$Enums.TipoMovimiento;
        id: string;
        createdAt: Date;
        iglesiaId: string;
    }>;
    private requireIglesiaId;
}
