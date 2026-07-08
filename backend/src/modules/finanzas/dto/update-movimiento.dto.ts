import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MedioPago } from '@prisma/client';

export class UpdateMovimientoDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoriaId?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  /** Si se envía, no puede quedar vacía: la descripción es obligatoria. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  descripcion?: string;

  @IsOptional()
  @IsEnum(MedioPago)
  medioPago?: MedioPago;
}
