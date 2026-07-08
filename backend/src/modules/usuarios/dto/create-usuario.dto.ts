import { Rol } from '@prisma/client';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { USERNAME_FORMAT_MESSAGE, USERNAME_REGEX } from '../../../common/utils/username';

const ROLES_ASIGNABLES = [Rol.TESORERO, Rol.SECRETARIA] as const;

export class CreateUsuarioDto {
  @Matches(USERNAME_REGEX, { message: USERNAME_FORMAT_MESSAGE })
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  /** El pastor solo puede crear roles de su equipo, nunca otro PASTOR o SUPER_ADMIN. */
  @IsIn(ROLES_ASIGNABLES)
  rol: (typeof ROLES_ASIGNABLES)[number];
}
