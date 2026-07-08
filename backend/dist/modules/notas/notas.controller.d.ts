import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateNotaDto } from './dto/create-nota.dto';
import { UpdateNotaDto } from './dto/update-nota.dto';
import { NotasService } from './notas.service';
export declare class NotasController {
    private readonly notasService;
    constructor(notasService: NotasService);
    findAll(user: JwtPayload): Promise<({
        creadoPor: {
            nombre: string;
            apellido: string;
        };
        asignadoA: {
            nombre: string;
            id: string;
            apellido: string;
        } | null;
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoNota;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string;
        estado: import(".prisma/client").$Enums.EstadoTarea;
        fechaLimite: Date | null;
        asignadoAId: string | null;
        notificado: boolean;
    })[]>;
    findMisTareas(user: JwtPayload): Promise<({
        creadoPor: {
            nombre: string;
            apellido: string;
        };
        asignadoA: {
            nombre: string;
            id: string;
            apellido: string;
        } | null;
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoNota;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string;
        estado: import(".prisma/client").$Enums.EstadoTarea;
        fechaLimite: Date | null;
        asignadoAId: string | null;
        notificado: boolean;
    })[]>;
    create(user: JwtPayload, dto: CreateNotaDto): Promise<{
        creadoPor: {
            nombre: string;
            apellido: string;
        };
        asignadoA: {
            nombre: string;
            id: string;
            apellido: string;
        } | null;
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoNota;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string;
        estado: import(".prisma/client").$Enums.EstadoTarea;
        fechaLimite: Date | null;
        asignadoAId: string | null;
        notificado: boolean;
    }>;
    update(user: JwtPayload, id: string, dto: UpdateNotaDto): Promise<{
        creadoPor: {
            nombre: string;
            apellido: string;
        };
        asignadoA: {
            nombre: string;
            id: string;
            apellido: string;
        } | null;
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoNota;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string;
        estado: import(".prisma/client").$Enums.EstadoTarea;
        fechaLimite: Date | null;
        asignadoAId: string | null;
        notificado: boolean;
    }>;
    marcarHecha(user: JwtPayload, id: string): Promise<{
        creadoPor: {
            nombre: string;
            apellido: string;
        };
        asignadoA: {
            nombre: string;
            id: string;
            apellido: string;
        } | null;
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoNota;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string;
        estado: import(".prisma/client").$Enums.EstadoTarea;
        fechaLimite: Date | null;
        asignadoAId: string | null;
        notificado: boolean;
    }>;
    remove(user: JwtPayload, id: string): Promise<void>;
    private requireIglesiaId;
}
