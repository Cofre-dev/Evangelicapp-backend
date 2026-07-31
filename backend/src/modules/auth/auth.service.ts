import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ModuloSistema, Rol, Usuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { generateCsrfToken } from '../../common/utils/generate-csrf-token';
import { generateSecureToken } from '../../common/utils/generate-secure-token';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

export type SafeUsuario = Omit<Usuario, 'password'> & {
  /** Para que el pastor/equipo vea el logo y nombre de su iglesia en la app. */
  iglesia: { nombre: string; logoUrl: string | null } | null;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Token double-submit para CSRF; viaja en una cookie legible por JS, no en el body. */
  csrfToken: string;
}

export interface LoginResponse extends AuthTokens {
  usuario: SafeUsuario & { modulos: ModuloSistema[] };
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
}

export type PerfilResponse = SafeUsuario & {
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
  /** Módulos otorgados leídos frescos de la BD (ver comentario en getProfile). */
  modulos: ModuloSistema[];
};

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
      usuario: {
        ...(await this.attachIglesia(usuario)),
        modulos: await this.getModulosOtorgados(usuario),
      },
      requiresPasswordChange: usuario.mustChangePassword,
      requiresOnboarding: !usuario.onboardingCompletado,
    };
  }

  /**
   * Rehidrata la sesión en el frontend (F5, apertura de pestaña nueva, etc).
   *
   * A diferencia del claim `modulos` del JWT (fijado al emitir el token), acá se
   * leen frescos de la BD para que el frontend pueda pintar el menú al día apenas
   * el MANAGER otorga/revoca un módulo — aunque la API todavía no lo permita hasta
   * que el access token actual expire y se refresque (hasta 15 min, ver
   * ModuloAccessGuard/JwtStrategy). Es la misma ventana ya aceptada para `rol`.
   */
  async getProfile(usuarioId: string): Promise<PerfilResponse> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    return {
      ...(await this.attachIglesia(usuario)),
      requiresPasswordChange: usuario.mustChangePassword,
      requiresOnboarding: !usuario.onboardingCompletado,
      modulos: await this.getModulosOtorgados(usuario),
    };
  }

  async refreshTokens(payload: JwtRefreshPayload): Promise<AuthTokens> {
    const tokenHash = this.hashToken(payload.refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usuarioId !== payload.sub || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (stored.revoked) {
      // Reuso de un refresh token que ya fue rotado: puede ser un robo (alguien
      // reproduciendo un token viejo) o dos tabs refrescando casi al mismo tiempo
      // — no hay forma de distinguirlos acá. Ante la duda, se cierra la sesión
      // en todos los dispositivos y se obliga a loguear de nuevo.
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: stored.usuarioId, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Update atómico y condicional: si dos requests llegan con el mismo token
    // casi al mismo tiempo, solo una gana la carrera (count === 1) y rota el
    // token; la otra ve count === 0 y recibe un 401 simple, sin gatillar la
    // detección de reuso de arriba (que es para un token YA rotado antes).
    const rotated = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revoked: false },
      data: { revoked: true },
    });

    if (rotated.count === 0) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inválido o inactivo');
    }

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

  /** Autoedición del perfil: solo datos personales. Username/email/rol quedan fuera de alcance. */
  async updateMe(usuarioId: string, dto: UpdateMyProfileDto): Promise<PerfilResponse> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { nombre: dto.nombre, apellido: dto.apellido, telefono: dto.telefono },
    });

    return this.getProfile(usuarioId);
  }

  /** Reemplaza la foto de perfil, borrando el archivo anterior del disco si existía. */
  async updateMiFoto(usuarioId: string, foto: Express.Multer.File): Promise<PerfilResponse> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    if (usuario.fotoUrl) {
      const previousPath = join(process.cwd(), usuario.fotoUrl.replace(/^\//, ''));
      await unlink(previousPath).catch(() => undefined);
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoUrl: `/uploads/perfiles/${foto.filename}` },
    });

    return this.getProfile(usuarioId);
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
      modulos: await this.getModulosOtorgados(usuario),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
        // jti único: sin esto, dos refresh casi simultáneos del mismo usuario
        // (multi-dispositivo) firman el mismo JWT byte-idéntico (mismo payload +
        // mismo iat/exp) y el segundo create() revienta el @@unique de tokenHash.
        jwtid: generateSecureToken(16),
      }),
    ]);

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        usuarioId: usuario.id,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken, csrfToken: generateCsrfToken() };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Solo USUARIO tiene módulos delegados por AccesoModulo (ver AccesosModule); para el
   * resto de los roles el acceso a módulos no se decide por esta lista (MANAGER tiene
   * acceso total vía ModuloAccessGuard, SUPER_ADMIN/MIEMBRO no usan estos módulos), así
   * que se evita la query en esos casos.
   */
  private async getModulosOtorgados(usuario: Usuario): Promise<ModuloSistema[]> {
    if (usuario.rol !== Rol.USUARIO) {
      return [];
    }

    const accesos = await this.prisma.accesoModulo.findMany({
      where: { usuarioId: usuario.id },
      select: { modulo: true },
    });

    return accesos.map((acceso) => acceso.modulo);
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
