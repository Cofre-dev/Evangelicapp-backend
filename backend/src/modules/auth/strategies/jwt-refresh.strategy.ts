import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

/**
 * Valida la firma/expiración del refresh token (body.refreshToken).
 * La verificación de que ese token siga vigente y no revocado en BD
 * ocurre en AuthService.refreshTokens, comparando su hash.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request<unknown, unknown, { refreshToken: string }>, payload: JwtPayload): JwtRefreshPayload {
    return { ...payload, refreshToken: req.body.refreshToken };
  }
}
