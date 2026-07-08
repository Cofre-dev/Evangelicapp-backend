import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard por defecto para toda ruta autenticada. Delega en JwtStrategy,
 * que además revalida en cada request que el usuario siga activo.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
