import { TipoEvento } from '@prisma/client';
export declare class PredicadorInvitadoDto {
    email: string;
    nombre?: string;
}
export declare class CreateEventoDto {
    titulo: string;
    descripcion?: string;
    tipo: TipoEvento;
    fechaInicio: string;
    fechaFin: string;
    ubicacion?: string;
    colorEtiqueta?: string;
    predicadores?: PredicadorInvitadoDto[];
}
