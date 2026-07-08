import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

export type SafeUsuario = Omit<Usuario, 'password'> & {
  /** Para que el pastor/equipo vea el logo y nombre de su iglesia en la app. */
  iglesia: { nombre: string; logoUrl: string | null } | null;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  usuario: SafeUsuario;
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Usado por LocalStrategy. Mensaje de error genérico para no filtrar si el usuario existe. */
  async validateUser(username: string, password: string): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({ where: { username } });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await bcrypt.compare(password, usuario.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return usuario;
  }

  /**
   * Login inicial (incluye el primer ingreso del pastor con credenciales temporales).
   * El frontend usa requiresPasswordChange / requiresOnboarding para decidir si
   * muestra el modal obligatorio antes de dejar entrar a cualquier otra pantalla.
   */
  async login(usuario: Usuario): Promise<LoginResponse> {
    const tokens = await this.issueTokens(usuario);

    return {
      ...tokens,
      usuario: await this.attachIglesia(usuario),
      requiresPasswordChange: usuario.mustChangePassword,
      requiresOnboarding: !usuario.onboardingCompletado,
    };
  }

  /** Rehidrata la sesión en el frontend (F5, apertura de pestaña nueva, etc). */
  async getProfile(
    usuarioId: string,
  ): Promise<SafeUsuario & { requiresPasswordChange: boolean; requiresOnboarding: boolean }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    return {
      ...(await this.attachIglesia(usuario)),
      requiresPasswordChange: usuario.mustChangePassword,
      requiresOnboarding: !usuario.onboardingCompletado,
    };
  }

  async refreshTokens(payload: JwtRefreshPayload): Promise<AuthTokens> {
    const tokenHash = this.hashToken(payload.refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (
      !stored ||
      stored.revoked ||
      stored.usuarioId !== payload.sub ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inválido o inactivo');
    }

    // Rotación: el refresh token usado queda inservible aunque no haya expirado.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(usuario);
  }

  async logout(usuarioId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * Cambio de contraseña forzado (o voluntario). Al completarse limpia
   * mustChangePassword y revoca las demás sesiones activas del usuario.
   */
  async changePassword(usuarioId: string, dto: ChangePasswordDto): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, usuario.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { password: newPasswordHash, mustChangePassword: false },
      }),
      this.prisma.refreshToken.updateMany({
        where: { usuarioId, revoked: false },
        data: { revoked: true },
      }),
    ]);
  }

  /** Confirmación de identidad para acciones sensibles (ej. eliminar un movimiento financiero). */
  async verifyPassword(usuarioId: string, password: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    const passwordMatches = await bcrypt.compare(password, usuario.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }
  }

  private async issueTokens(usuario: Usuario): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      iglesiaId: usuario.iglesiaId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        usuarioId: usuario.id,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async attachIglesia(usuario: Usuario): Promise<SafeUsuario> {
    const iglesia = usuario.iglesiaId
      ? await this.prisma.iglesia.findUnique({
          where: { id: usuario.iglesiaId },
          select: { nombre: true, logoUrl: true },
        })
      : null;

    const { password, ...safe } = usuario;
    return { ...safe, iglesia };
  }
}
