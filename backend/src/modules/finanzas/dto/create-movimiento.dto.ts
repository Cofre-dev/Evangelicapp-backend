import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { MedioPago } from '@prisma/client';

export class CreateMovimientoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  /** El tipo (INGRESO/EGRESO) del movimiento se toma de la categoría, no del cliente. */
  @IsString()
  @IsNotEmpty()
  categoriaId: string;

  @IsDateString()
  fecha: string;

  /** Obligatoria: transparencia de en qué consiste cada movimiento. */
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsEnum(MedioPago)
  medioPago: MedioPago;
}
