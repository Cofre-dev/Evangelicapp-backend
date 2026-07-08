import { randomBytes } from 'crypto';

/** Token opaco para el patrón double-submit cookie (no es un JWT, no lleva información). */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}
