import { IsBoolean } from 'class-validator';

export class VerificarIglesiaDto {
  @IsBoolean()
  verificada: boolean;
}
