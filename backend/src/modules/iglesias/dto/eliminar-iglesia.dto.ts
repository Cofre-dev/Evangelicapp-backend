import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Borrado permanente de una iglesia (SuperAdmin). Doble resguardo:
 * - `motivo`: va textual en el correo de despedida al pastor.
 * - `confirmacionNombre`: el nombre exacto de la iglesia, tipeado a mano (se
 *   compara en el servicio, sin distinguir espacios de los extremos).
 */
export class EliminarIglesiaDto {
  @IsString()
  @MinLength(10, { message: 'Explica el motivo con al menos 10 caracteres' })
  @MaxLength(1000)
  motivo: string;

  @IsString()
  @MaxLength(200)
  confirmacionNombre: string;
}
