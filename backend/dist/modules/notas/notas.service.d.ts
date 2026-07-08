import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotaDto } from './dto/create-nota.dto';
import { UpdateNotaDto } from './dto/update-nota.dto';
export declare class NotasService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(iglesiaId: string): Promise<({
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
    findMisTareas(iglesiaId: string, usuarioId: string): Promise<({
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
    findOne(iglesiaId: string, id: string): Promise<{
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
    create(iglesiaId: string, usuarioId: string, dto: CreateNotaDto): Promise<{
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
    update(iglesiaId: string, id: string, dto: UpdateNotaDto): Promise<{
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
    marcarHecha(iglesiaId: string, usuarioId: string, id: string): Promise<{
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
    remove(iglesiaId: string, id: string): Promise<void>;
    private usuarioDeLaIglesiaOrThrow;
}
