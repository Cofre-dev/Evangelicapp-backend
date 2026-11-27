import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USERNAME_FORMAT_MESSAGE, USERNAME_REGEX } from '../../../common/utils/username';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Formulario público "Registra tu iglesia" (plan GRATUITO). */
export class RegistroIglesiaDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreIglesia: string;

  /** Tiene que existir en el catálogo de chile-regiones.ts (mismo que el frontend). */
  @IsString()
  @IsNotEmpty()
  region: string;

  @IsString()
  @IsNotEmpty()
  comuna: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  pastorNombre: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  pastorApellido: string;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(USERNAME_REGEX, { message: USERNAME_FORMAT_MESSAGE })
  username: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  telefono?: string;

  /** Mismas reglas que ChangePasswordDto. */
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar los 72 caracteres' })
  @Matches(/(?=.*[a-zA-Z])(?=.*[0-9])/, {
    message: 'La contraseña debe tener al menos una letra y un número',
  })
  password: string;

  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar los términos y la política de privacidad' })
  aceptaTerminos: boolean;

  /** Token del widget Cloudflare Turnstile. Obligatorio si el backend tiene TURNSTILE_SECRET_KEY. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
