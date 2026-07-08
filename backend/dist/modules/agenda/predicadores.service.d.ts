import { PrismaService } from '../../prisma/prisma.service';
export declare class PredicadoresService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getInvitacion(token: string): Promise<{
        nombre: string | null;
        email: string;
        estado: import(".prisma/client").$Enums.EstadoConfirmacionPredicador;
        respondidoAt: Date | null;
        evento: {
            titulo: string;
            fechaInicio: Date;
            fechaFin: Date;
            ubicacion: string | null;
        };
        iglesia: {
            nombre: string;
            logoUrl: string | null;
        };
    }>;
    responder(token: string, respuesta: 'CONFIRMADO' | 'RECHAZADO'): Promise<{
        nombre: string | null;
        email: string;
        estado: import(".prisma/client").$Enums.EstadoConfirmacionPredicador;
        respondidoAt: Date | null;
        evento: {
            titulo: string;
            fechaInicio: Date;
            fechaFin: Date;
            ubicacion: string | null;
        };
        iglesia: {
            nombre: string;
            logoUrl: string | null;
        };
    }>;
}
