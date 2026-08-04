import { IsDateString } from 'class-validator';

/** Corrección manual de la fecha de facturación (ej. el SuperAdmin se equivocó al crear la iglesia). */
export class ActualizarFacturacionDto {
  @IsDateString()
  proximaFacturacion: string;
}
