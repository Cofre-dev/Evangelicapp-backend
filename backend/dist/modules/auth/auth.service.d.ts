import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
export type SafeUsuario = Omit<Usuario, 'password'> & {
    iglesia: {
        nombre: string;
        logoUrl: string | null;
    } | null;
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
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly config;
    constructor(prisma: PrismaService, jwtService: JwtService, config: ConfigService);
    validateUser(username: string, password: string): Promise<Usuario>;
    login(usuario: Usuario): Promise<LoginResponse>;
    getProfile(usuarioId: string): Promise<SafeUsuario & {
        requiresPasswordChange: boolean;
        requiresOnboarding: boolean;
    }>;
    refreshTokens(payload: JwtRefreshPayload): Promise<AuthTokens>;
    logout(usuarioId: string): Promise<void>;
    changePassword(usuarioId: string, dto: ChangePasswordDto): Promise<void>;
    verifyPassword(usuarioId: string, password: string): Promise<void>;
    private issueTokens;
    private hashToken;
    private attachIglesia;
}
