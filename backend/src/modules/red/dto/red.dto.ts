import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoLlamado, TipoLlamado, TipoNecesidad, VisibilidadLlamado } from '@prisma/client';

// ---------------------------------------------------------------------------
// Perfil y directorio
// ---------------------------------------------------------------------------

export class UpdatePerfilRedDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  @IsOptional()
  @IsEmail()
  emailContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefonoContacto?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'sitioWeb debe ser una URL completa (https://...)' })
  @MaxLength(200)
  sitioWeb?: string | null;

  /** Aparecer o no en el listado del directorio. */
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class DirectorioQueryDto {
  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  comuna?: string;

  /** Búsqueda por nombre. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

// ---------------------------------------------------------------------------
// Llamados de ayuda
// ---------------------------------------------------------------------------

export class NecesidadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @IsEnum(TipoNecesidad)
  tipo: TipoNecesidad;

  /** Meta numérica opcional (ej. 20 voluntarios). Sin meta = "lo que puedan aportar". */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  cantidadMeta?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unidad?: string;
}

export class CreateLlamadoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  descripcion: string;

  @IsEnum(TipoLlamado)
  tipo: TipoLlamado;

  @IsEnum(VisibilidadLlamado)
  visibilidad: VisibilidadLlamado;

  /** Si no vienen, se usa la región/comuna de la iglesia. Si vienen, van juntas y del catálogo. */
  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  comuna?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => NecesidadDto)
  necesidades?: NecesidadDto[];
}

/** Edición de un llamado propio: solo textos, lugar y fechas (las necesidades no se editan). */
export class UpdateLlamadoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string | null;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string | null;

  @IsOptional()
  @IsDateString()
  fechaFin?: string | null;
}

export class CambiarEstadoLlamadoDto {
  @IsEnum(EstadoLlamado)
  estado: EstadoLlamado;
}

export const ALCANCES_FEED = ['TODO', 'COMUNA', 'REGION', 'NACIONAL', 'ALIADAS'] as const;
export type AlcanceFeed = (typeof ALCANCES_FEED)[number];

export class FeedQueryDto {
  /** TODO (default) = todo lo relevante para la iglesia; o un alcance puntual. */
  @IsOptional()
  @IsIn(ALCANCES_FEED)
  alcance?: AlcanceFeed;

  /** Por defecto solo ABIERTO + CUBIERTO; `incluirCerrados=true` suma los CERRADO. */
  @IsOptional()
  @IsIn(['true', 'false'])
  incluirCerrados?: string;

  @IsOptional()
  @IsEnum(TipoLlamado)
  tipo?: TipoLlamado;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

export class CreateCompromisoDto {
  /** Necesidad puntual del llamado; sin ella, es un apoyo general al llamado. */
  @IsOptional()
  @IsString()
  necesidadId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  cantidad?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string;
}

export class ReportarLlamadoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}

// ---------------------------------------------------------------------------
// Alianzas
// ---------------------------------------------------------------------------

export class SolicitarAlianzaDto {
  @IsString()
  @IsNotEmpty()
  iglesiaId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string;
}

export class ResponderAlianzaDto {
  @IsBoolean()
  aceptar: boolean;
}

// ---------------------------------------------------------------------------
// Notificaciones y moderación
// ---------------------------------------------------------------------------

export class NotificacionesQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  soloNoLeidas?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

export class PreferenciasNotificacionesDto {
  @IsBoolean()
  notificacionesRedEmail: boolean;
}

export class ModerarLlamadoDto {
  @IsBoolean()
  oculto: boolean;
}
