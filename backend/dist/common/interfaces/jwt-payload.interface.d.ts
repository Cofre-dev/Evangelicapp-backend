import { Rol } from '@prisma/client';
export interface JwtPayload {
    sub: string;
    email: string;
    rol: Rol;
    iglesiaId: string | null;
}
