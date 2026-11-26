import { TipoMovimiento } from '@prisma/client';

/**
 * Lógica pura del reporte financiero a la congregación (sin Prisma ni Nest), separada
 * del servicio para poder testearla sin mocks (ver reporte-congregacion.util.spec.ts).
 *
 * Los períodos son meses calendario en UTC, formato `YYYY-MM` — mismo criterio que
 * `bucket-por-mes.util.ts`. `MovimientoFinanciero.fecha` llega como fecha sin hora
 * (`IsDateString`, ej. "2026-10-31" → medianoche UTC), así que un mes UTC calza exacto
 * con el mes que eligió quien registró el movimiento.
 */

export const OTROS_INGRESOS_LABEL = 'Otros ingresos';
export const OTROS_EGRESOS_LABEL = 'Otros egresos';

/** Cuántos meses hacia atrás se puede enviar a mano un reporte que no salió. */
export const MESES_ATRAS_ENVIO_MANUAL = 12;

const PERIODO_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export interface TotalPorCategoria {
  categoria: string;
  total: number;
}

/**
 * Lo único que sale de la iglesia hacia la congregación. A propósito NO incluye
 * descripciones de movimientos (pueden nombrar personas: "Diezmo Juan Pérez"), ni
 * montos individuales, ni quién registró qué: solo totales por categoría.
 */
export interface ReporteFinancieroData {
  periodo: string;
  totales: { ingresos: number; egresos: number; balance: number };
  ingresosPorCategoria: TotalPorCategoria[];
  egresosPorCategoria: TotalPorCategoria[];
}

/** Una fila ya agregada por la base (groupBy categoría + tipo). */
export interface SumaPorCategoria {
  tipo: TipoMovimiento;
  categoria: string;
  ocultaEnReporte: boolean;
  total: number;
}

export function esPeriodoValido(periodo: string): boolean {
  return PERIODO_REGEX.test(periodo);
}

export function periodoDe(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** El último mes ya cerrado respecto de `ahora` (en noviembre → octubre). */
export function periodoAnterior(ahora: Date = new Date()): string {
  return periodoDe(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1)));
}

/** `[desde, hasta)`: primer instante del mes y primer instante del mes siguiente (UTC). */
export function rangoPeriodo(periodo: string): { desde: Date; hasta: Date } {
  const match = PERIODO_REGEX.exec(periodo);
  if (!match) {
    throw new Error(`Período inválido: ${periodo}`);
  }
  const anio = Number(match[1]);
  const mes = Number(match[2]) - 1;
  return { desde: new Date(Date.UTC(anio, mes, 1)), hasta: new Date(Date.UTC(anio, mes + 1, 1)) };
}

/** Primer día (UTC) del mes en curso respecto de `ahora`. */
export function inicioMesActual(ahora: Date = new Date()): Date {
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
}

/**
 * Un período se puede enviar a mano si ya está cerrado (anterior al mes en curso) y no
 * tiene más de `MESES_ATRAS_ENVIO_MANUAL` meses de antigüedad.
 */
export function esPeriodoEnviable(periodo: string, ahora: Date = new Date()): boolean {
  if (!esPeriodoValido(periodo)) {
    return false;
  }
  const { desde } = rangoPeriodo(periodo);
  const limiteMasAntiguo = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - MESES_ATRAS_ENVIO_MANUAL, 1),
  );
  return desde < inicioMesActual(ahora) && desde >= limiteMasAntiguo;
}

/** "2026-10" → "octubre de 2026". */
export function nombrePeriodo(periodo: string): string {
  const { desde } = rangoPeriodo(periodo);
  return `${MESES_ES[desde.getUTCMonth()]} de ${desde.getUTCFullYear()}`;
}

function redondear(monto: number): number {
  return Math.round(monto * 100) / 100;
}

function agrupar(filas: SumaPorCategoria[], labelOtros: string): TotalPorCategoria[] {
  const visibles = new Map<string, number>();
  let otros = 0;

  for (const fila of filas) {
    if (fila.ocultaEnReporte) {
      otros += fila.total;
      continue;
    }
    // Dos categorías con el mismo nombre (ej. "Ofrendas" general y "Ofrendas" de un
    // departamento) se muestran como una sola línea: para la congregación son lo mismo.
    visibles.set(fila.categoria, (visibles.get(fila.categoria) ?? 0) + fila.total);
  }

  const resultado = [...visibles.entries()]
    .map(([categoria, total]) => ({ categoria, total: redondear(total) }))
    .filter((fila) => fila.total !== 0)
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, 'es'));

  if (redondear(otros) !== 0) {
    resultado.push({ categoria: labelOtros, total: redondear(otros) });
  }
  return resultado;
}

/**
 * Arma el reporte a partir de las sumas por categoría. Las categorías ocultas se suman
 * en "Otros ingresos"/"Otros egresos": se esconde el nombre, nunca el monto, así que los
 * totales del reporte siempre cuadran con el dashboard de finanzas de ese mes.
 */
export function construirReporte(periodo: string, filas: SumaPorCategoria[]): ReporteFinancieroData {
  const ingresos = filas.filter((f) => f.tipo === TipoMovimiento.INGRESO);
  const egresos = filas.filter((f) => f.tipo === TipoMovimiento.EGRESO);
  const totalIngresos = redondear(ingresos.reduce((suma, f) => suma + f.total, 0));
  const totalEgresos = redondear(egresos.reduce((suma, f) => suma + f.total, 0));

  return {
    periodo,
    totales: {
      ingresos: totalIngresos,
      egresos: totalEgresos,
      balance: redondear(totalIngresos - totalEgresos),
    },
    ingresosPorCategoria: agrupar(ingresos, OTROS_INGRESOS_LABEL),
    egresosPorCategoria: agrupar(egresos, OTROS_EGRESOS_LABEL),
  };
}

/** Primer nombre para el saludo del correo ("María José Pérez" → "María"). */
export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? '';
}
