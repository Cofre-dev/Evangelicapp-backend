import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EstadoIglesia, Rol } from '@prisma/client';
import { Request } from 'express';
import { MUST_CHANGE_PASSWORD_ALLOWLIST } from '../constants/must-change-password-allowlist';
import { IglesiaSuspendidaException } from '../exceptions/iglesia-suspendida.exception';
import { calcularEstadoFacturacion } from '../utils/calcular-facturacion';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseJwtVerifierService } from '../../supabase/supabase-jwt-verifier.service';

/**
 * Fase 7 de docs/supabase.md, paso 4 — TODAVÍA INERTE: ningún controller lo usa.
 * Reimplementa, sobre un token de Supabase Auth en vez del JWT propio, las mismas
 * 3 revalidaciones por-request que hoy hace `JwtStrategy.validate()`:
 * `activo`, `iglesia.estado === SUSPENDIDA`, y el allowlist de `mustChangePassword`
 * (mismo `MUST_CHANGE_PASSWORD_ALLOWLIST` compartido — ver ese archivo).
 *
 * Extrae el token del header `Authorization: Bearer` (no de una cookie): el
 * esquema de cookies/CSRF definitivo para Supabase Auth es una decisión aparte
 * (paso 7) — usar Bearer acá evita presumir esa respuesta todavía y alcanza para
 * probar este guard de forma aislada.
 *
 * `modulos` (paso 5): se resuelve consultando `AccesoModulo` en la MISMA query que
 * ya hace este guard para `activo`/`iglesia` — no un query aparte, y no un Custom
 * Access Token Hook (Edge Function) del lado de Supabase. Se descartó el Hook a
 * propósito: exigiría desplegar y mantener una función Postgres en el proyecto de
 * Supabase, y el resultado sería estrictamente PEOR que consultar acá — un Hook solo
 * refresca el claim al emitir/refrescar el token de Supabase (misma "ventana acotada"
 * de hasta 15 min que ya existe hoy vía `JwtStrategy`, ver su comentario), mientras
 * que consultar en este guard da el módulo al día en cada request, gratis, porque el
 * guard ya paga una query por request de todas formas. Igual que
 * `AuthService#getModulosOtorgados`, solo se consulta para `Rol.USUARIO` — para el
 * resto de los roles el acceso a módulos no se decide por esta lista.
 */
@Injectable()
export class SupabaseJwtAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: SupabaseJwtVerifierService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Falta el token de Supabase Auth');
    }

    const usuarioId = await this.verifier.verifyAndExtractUsuarioId(token);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        rol: true,
        iglesiaId: true,
        activo: true,
        mustChangePassword: true,
        iglesia: { select: { estado: true, proximaFacturacion: true } },
        accesosPropios: { select: { modulo: true } },
      },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Sesión inválida o usuario inactivo');
    }

    if (usuario.iglesia?.estado === EstadoIglesia.SUSPENDIDA) {
      const { diasEnMora } = calcularEstadoFacturacion(usuario.iglesia.proximaFacturacion);
      throw new IglesiaSuspendidaException(diasEnMora);
    }

    if (usuario.mustChangePassword && !MUST_CHANGE_PASSWORD_ALLOWLIST.has(request.path)) {
      throw new ForbiddenException('Debe cambiar su contraseña temporal antes de continuar');
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      iglesiaId: usuario.iglesiaId,
      modulos: usuario.rol === Rol.USUARIO ? usuario.accesosPropios.map((acceso) => acceso.modulo) : [],
    };

    (request as Request & { user: JwtPayload }).user = payload;
    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length);
  }
}
