import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TipoEvento } from '@prisma/client';

export class PredicadorInvitadoDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  nombre?: string;
}

export class CreateEventoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(TipoEvento)
  tipo: TipoEvento;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  colorEtiqueta?: string;

  /** Solo tiene sentido cuando tipo = CULTO; se ignora para el resto. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PredicadorInvitadoDto)
  predicadores?: PredicadorInvitadoDto[];
}
