import { Rol } from '@prisma/client';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const ROLES_ASIGNABLES = [Rol.TESORERO, Rol.SECRETARIA] as const;

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apellido?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsIn(ROLES_ASIGNABLES)
  rol?: (typeof ROLES_ASIGNABLES)[number];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
