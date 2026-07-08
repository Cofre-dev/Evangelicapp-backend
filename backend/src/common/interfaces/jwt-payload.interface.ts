import { Rol } from '@prisma/client';

/**
 * Forma del access token. `iglesiaId` es null únicamente para SUPER_ADMIN.
 * Todo guard/service que necesite aislar por tenant lee este campo,
 * nunca un iglesiaId enviado por el cliente en body/query/params.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  iglesiaId: string | null;
}
