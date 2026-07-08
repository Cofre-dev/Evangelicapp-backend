import { TipoMovimiento } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(TipoMovimiento)
  tipo: TipoMovimiento;
}
