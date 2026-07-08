import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Usuario } from '@prisma/client';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/** Se usa solo en POST /auth/login (vía LocalAuthGuard). Los nombres username/password son los que Passport espera por defecto. */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'username', passwordField: 'password' });
  }

  async validate(username: string, password: string): Promise<Usuario> {
    return this.authService.validateUser(username, password);
  }
}
