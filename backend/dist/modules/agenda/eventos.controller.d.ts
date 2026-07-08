import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { EventosService } from './eventos.service';
export declare class EventosController {
    private readonly eventosService;
    constructor(eventosService: EventosService);
    findAll(user: JwtPayload, from?: string, to?: string): Promise<({
        predicadores: {
            email: string;
            nombre: string | null;
            id: string;
            createdAt: Date;
            estado: import(".prisma/client").$Enums.EstadoConfirmacionPredicador;
            tokenConfirmacion: string;
            respondidoAt: Date | null;
            eventoId: string;
        }[];
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoEvento;
        fechaInicio: Date;
        fechaFin: Date;
        ubicacion: string | null;
        colorEtiqueta: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string | null;
    })[]>;
    findOne(user: JwtPayload, id: string): Promise<{
        predicadores: {
            email: string;
            nombre: string | null;
            id: string;
            createdAt: Date;
            estado: import(".prisma/client").$Enums.EstadoConfirmacionPredicador;
            tokenConfirmacion: string;
            respondidoAt: Date | null;
            eventoId: string;
        }[];
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoEvento;
        fechaInicio: Date;
        fechaFin: Date;
        ubicacion: string | null;
        colorEtiqueta: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string | null;
    }>;
    create(user: JwtPayload, dto: CreateEventoDto): Promise<{
        predicadores: {
            email: string;
            nombre: string | null;
            id: string;
            createdAt: Date;
            estado: import(".prisma/client").$Enums.EstadoConfirmacionPredicador;
            tokenConfirmacion: string;
            respondidoAt: Date | null;
            eventoId: string;
        }[];
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoEvento;
        fechaInicio: Date;
        fechaFin: Date;
        ubicacion: string | null;
        colorEtiqueta: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string | null;
    }>;
    update(user: JwtPayload, id: string, dto: UpdateEventoDto): Promise<{
        predicadores: {
            email: string;
            nombre: string | null;
            id: string;
            createdAt: Date;
            estado: import(".prisma/client").$Enums.EstadoConfirmacionPredicador;
            tokenConfirmacion: string;
            respondidoAt: Date | null;
            eventoId: string;
        }[];
    } & {
        titulo: string;
        descripcion: string | null;
        tipo: import(".prisma/client").$Enums.TipoEvento;
        fechaInicio: Date;
        fechaFin: Date;
        ubicacion: string | null;
        colorEtiqueta: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string | null;
    }>;
    remove(user: JwtPayload, id: string): Promise<void>;
    private requireIglesiaId;
}
