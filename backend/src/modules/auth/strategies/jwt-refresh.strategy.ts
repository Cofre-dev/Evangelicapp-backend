import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { REFRESH_TOKEN_COOKIE } from '../../../common/constants/auth-cookies';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_TOKEN_COOKIE] ?? null;
}

/**
 * Valida la firma/expiración del refresh token, leído de su cookie httpOnly
 * (Path restringido a /auth/refresh, el navegador no la manda en ninguna otra
 * ruta). La verificación de que ese token siga vigente y no revocado en BD
 * ocurre en AuthService.refreshTokens, comparando su hash.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    return { ...payload, refreshToken: cookieExtractor(req) as string };
  }
}
