import { IsOptional, Matches } from 'class-validator';

export class EnviarReporteDto {
  /** Mes a enviar (`YYYY-MM`). Si no viene, el último mes cerrado. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo debe tener formato YYYY-MM' })
  periodo?: string;
}
