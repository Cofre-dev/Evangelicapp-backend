import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { EstadoIglesia } from '@prisma/client';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from '../../../common/constants/auth-cookies';
import { IglesiaSuspendidaException } from '../../../common/exceptions/iglesia-suspendida.exception';
import { calcularEstadoFacturacion } from '../../../common/utils/calcular-facturacion';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../../prisma/prisma.service';

function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

/**
 * Rutas alcanzables con `mustChangePassword === true`. Todo lo demás responde 403
 * hasta que el usuario cambie la contraseña temporal — sin esto, `mustChangePassword`
 * era solo una señal advisoria para que el FRONTEND mostrara una pantalla obligatoria,
 * pero un cliente que hablara directo con la API podía seguir usando cualquier
 * endpoint de su rol indefinidamente sin cambiar la contraseña temporal.
 */
const MUST_CHANGE_PASSWORD_ALLOWLIST: ReadonlySet<string> = new Set([
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/onboarding/complete',
]);

// `onboardingCompletado` (solo MANAGER) se deja sin bloqueo de servidor a propósito por ahora:
// a diferencia de mustChangePassword, requeriría decidir qué endpoints puede tocar un manager
// a mitad de onboarding (¿usuarios? ¿agenda?) — eso es una decisión de producto, no un bug técnico.

/**
 * Valida el access token en cada request y revalida contra la BD que el
 * usuario siga activo. Así, si un manager desactiva a un usuario de su
 * equipo, el acceso se corta de inmediato en vez de esperar a que expire el token.
 *
 * Acepta el token desde la cookie httpOnly (flujo actual) o desde el header
 * Authorization: Bearer (compatibilidad hacia atrás mientras el frontend
 * termina de migrar a cookies — remover el segundo extractor después).
 *
 * Limitación conocida: el claim `rol` (y `iglesiaId`, y `modulos`) del payload
 * no se revalida contra la BD en cada request, solo `activo` (y ahora
 * `mustChangePassword`). Si a alguien se le cambia el rol vía `PATCH
 * /usuarios/:id`, o el MANAGER le otorga/revoca un módulo vía `PUT
 * /accesos/usuarios/:id`, el cambio no tiene efecto hasta que expire su access
 * token actual (`JWT_ACCESS_EXPIRATION`, 15m por defecto) — ventana acotada,
 * aceptada a propósito; revalidar esto en cada request sería un cambio de
 * arquitectura mayor (fuera de alcance por ahora).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        activo: true,
        mustChangePassword: true,
        iglesia: { select: { estado: true, proximaFacturacion: true } },
      },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Sesión inválida o usuario inactivo');
    }

    // Igual que `activo`: se revalida en cada request para que ocultar una iglesia
    // por mora corte el acceso de inmediato, no cuando expire el access token vigente.
    if (usuario.iglesia?.estado === EstadoIglesia.SUSPENDIDA) {
      const { diasEnMora } = calcularEstadoFacturacion(usuario.iglesia.proximaFacturacion);
      throw new IglesiaSuspendidaException(diasEnMora);
    }

    if (usuario.mustChangePassword && !MUST_CHANGE_PASSWORD_ALLOWLIST.has(req.path)) {
      throw new ForbiddenException('Debe cambiar su contraseña temporal antes de continuar');
    }

    return payload;
  }
}
