import { MedioPago } from '@prisma/client';
export declare class CreateMovimientoDto {
    monto: number;
    categoriaId: string;
    fecha: string;
    descripcion: string;
    medioPago: MedioPago;
}
