import { EstadoTarea } from '@prisma/client';
export declare class UpdateNotaDto {
    titulo?: string;
    descripcion?: string;
    fechaLimite?: string;
    asignadoAId?: string | null;
    estado?: EstadoTarea;
}
