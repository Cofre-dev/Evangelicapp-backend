import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';
import { MedioPago } from '@prisma/client';

export class CreateMovimientoDto {
  /** Tope real de la columna `monto` (Decimal(12,2) en el schema): hasta 10 dígitos enteros. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
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
