import { MedioPago } from '@prisma/client';
export declare class UpdateMovimientoDto {
    monto?: number;
    categoriaId?: string;
    fecha?: string;
    descripcion?: string;
    medioPago?: MedioPago;
}
