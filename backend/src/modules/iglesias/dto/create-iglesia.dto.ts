import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { USERNAME_FORMAT_MESSAGE, USERNAME_REGEX } from '../../../common/utils/username';

export class CreateIglesiaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  comuna: string;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  // El pastor se crea junto con la iglesia: es el dueño del tenant y no
  // tiene sentido una iglesia sin nadie a cargo.
  @Matches(USERNAME_REGEX, { message: USERNAME_FORMAT_MESSAGE })
  pastorUsername: string;

  @IsEmail()
  pastorEmail: string;

  @IsString()
  @IsNotEmpty()
  pastorNombre: string;

  @IsString()
  @IsNotEmpty()
  pastorApellido: string;
}
