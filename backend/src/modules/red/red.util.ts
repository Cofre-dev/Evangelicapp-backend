import { TipoNecesidad } from '@prisma/client';

/** Lógica pura de la red (sin Prisma), testeada en red.util.spec.ts. */

interface NecesidadBase {
  id: string;
  descripcion: string;
  tipo: TipoNecesidad;
  cantidadMeta: number | null;
  unidad: string | null;
  orden: number;
}

interface CompromisoBase {
  iglesiaId: string;
  necesidadId: string | null;
  cantidad: number | null;
}

export interface ProgresoNecesidad {
  id: string;
  descripcion: string;
  tipo: TipoNecesidad;
  cantidadMeta: number | null;
  unidad: string | null;
  orden: number;
  /** Suma de las cantidades comprometidas (los apoyos sin cantidad suman 0). */
  comprometido: number;
  /** Iglesias distintas que se comprometieron con esta necesidad. */
  iglesias: number;
  /** Solo puede ser true si la necesidad tiene meta numérica. */
  cubierta: boolean;
}

/** Progreso de cada necesidad a partir de los compromisos ACTIVOS del llamado. */
export function calcularProgreso(
  necesidades: NecesidadBase[],
  compromisos: CompromisoBase[],
): ProgresoNecesidad[] {
  return necesidades.map((n) => {
    const propios = compromisos.filter((c) => c.necesidadId === n.id);
    const comprometido = propios.reduce((suma, c) => suma + (c.cantidad ?? 0), 0);
    return {
      id: n.id,
      descripcion: n.descripcion,
      tipo: n.tipo,
      cantidadMeta: n.cantidadMeta,
      unidad: n.unidad,
      orden: n.orden,
      comprometido,
      iglesias: new Set(propios.map((c) => c.iglesiaId)).size,
      cubierta: n.cantidadMeta !== null && comprometido >= n.cantidadMeta,
    };
  });
}

/**
 * ¿Todas las necesidades con meta numérica llegaron a su meta? null si el llamado no
 * tiene ninguna necesidad con meta: entonces no se marca CUBIERTO solo, lo decide la
 * iglesia a mano.
 */
export function coberturaCompleta(
  necesidades: NecesidadBase[],
  compromisos: CompromisoBase[],
): boolean | null {
  const conMeta = calcularProgreso(necesidades, compromisos).filter((n) => n.cantidadMeta !== null);
  if (conMeta.length === 0) {
    return null;
  }
  return conMeta.every((n) => n.cubierta);
}
