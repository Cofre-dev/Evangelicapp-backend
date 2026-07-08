import { TipoEvento } from '@prisma/client';
export declare class UpdateEventoDto {
    titulo?: string;
    descripcion?: string;
    tipo?: TipoEvento;
    fechaInicio?: string;
    fechaFin?: string;
    ubicacion?: string;
    colorEtiqueta?: string;
}
