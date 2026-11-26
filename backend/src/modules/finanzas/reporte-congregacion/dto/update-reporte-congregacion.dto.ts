import { IsBoolean } from 'class-validator';

export class UpdateReporteCongregacionDto {
  @IsBoolean()
  activo: boolean;
}
