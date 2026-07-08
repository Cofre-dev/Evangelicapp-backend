import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
export declare class EventosService {
    private readonly prisma;
    private readonly mailService;
    constructor(prisma: PrismaService, mailService: MailService);
    findAll(iglesiaId: string, from?: Date, to?: Date): Promise<({
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
    findOne(iglesiaId: string, id: string): Promise<{
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
    create(iglesiaId: string, usuarioId: string, dto: CreateEventoDto): Promise<{
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
    update(iglesiaId: string, id: string, dto: UpdateEventoDto): Promise<{
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
    private validarFechas;
    remove(iglesiaId: string, id: string): Promise<void>;
    private invitarPredicadores;
}
