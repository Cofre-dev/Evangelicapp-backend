import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

/**
 * Reemplaza la lista completa de categorías ocultas en el reporte (no es incremental):
 * las que vengan quedan ocultas y todas las demás de la iglesia vuelven a mostrarse.
 */
export class CategoriasOcultasDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  categoriaIds: string[];
}
