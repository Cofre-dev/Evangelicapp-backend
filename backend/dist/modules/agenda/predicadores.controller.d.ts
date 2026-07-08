import { ResponderPredicadorDto } from './dto/responder-predicador.dto';
import { PredicadoresService } from './predicadores.service';
export declare class PredicadoresController {
    private readonly predicadoresService;
    constructor(predicadoresService: PredicadoresService);
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
    responder(token: string, dto: ResponderPredicadorDto): Promise<{
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
