import { PlanIglesia } from '@prisma/client';

export interface LimitesPlan {
  maxUsuarios: number;
  maxDepartamentosFinancieros: number;
  /** Llamados de ayuda en la Red de iglesias abiertos (ABIERTO o CUBIERTO) al mismo tiempo. */
  maxLlamadosAbiertos: number;
}

/**
 * Topes de uso por plan comercial. `maxDepartamentosFinancieros: 0` significa "sin
 * acceso al módulo de subdepartamentos", no solo un límite bajo (ver
 * DepartamentosService#create). Estrategia comercial tipo "bencina 93/95/97":
 * siempre empujar al plan más caro (PRO) como el completo.
 *
 * GRATUITO: solo la Red de iglesias, con un único usuario (el pastor) y pocos llamados
 * abiertos a la vez — lo justo para que la red sea útil y el plan de pago tenga sentido
 * (decisión del fundador, 2026-11-26). El resto de los módulos lo bloquea JwtAuthGuard.
 */
export const PLAN_LIMITS: Record<PlanIglesia, LimitesPlan> = {
  [PlanIglesia.GRATUITO]: { maxUsuarios: 1, maxDepartamentosFinancieros: 0, maxLlamadosAbiertos: 2 },
  [PlanIglesia.BASICO]: { maxUsuarios: 3, maxDepartamentosFinancieros: 0, maxLlamadosAbiertos: 5 },
  [PlanIglesia.MEDIO]: { maxUsuarios: 8, maxDepartamentosFinancieros: 0, maxLlamadosAbiertos: 10 },
  [PlanIglesia.PRO]: { maxUsuarios: 15, maxDepartamentosFinancieros: 10, maxLlamadosAbiertos: 30 },
};

export const PLAN_LABEL: Record<PlanIglesia, string> = {
  [PlanIglesia.GRATUITO]: 'Gratuito',
  [PlanIglesia.BASICO]: 'Básico',
  [PlanIglesia.MEDIO]: 'Medio',
  [PlanIglesia.PRO]: 'Pro',
};

export function esPlanDePago(plan: PlanIglesia): boolean {
  return plan !== PlanIglesia.GRATUITO;
}

export const CONTACTO_VENTAS_EMAIL = 'contacto@evangelic.app';
