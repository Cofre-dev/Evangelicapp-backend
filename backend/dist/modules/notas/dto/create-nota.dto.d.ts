import { TipoNota } from '@prisma/client';
export declare class CreateNotaDto {
    tipo?: TipoNota;
    titulo: string;
    descripcion?: string;
    fechaLimite?: string;
    asignadoAId?: string;
}
