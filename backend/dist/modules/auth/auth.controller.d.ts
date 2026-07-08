import type { Request } from 'express';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthService, AuthTokens, LoginResponse } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(_dto: LoginDto, req: Request): Promise<LoginResponse>;
    refresh(_dto: RefreshTokenDto, req: Request): Promise<AuthTokens>;
    logout(user: JwtPayload): Promise<void>;
    me(user: JwtPayload): Promise<Omit<{
        email: string;
        nombre: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string | null;
        username: string;
        password: string;
        apellido: string;
        telefono: string | null;
        rol: import(".prisma/client").$Enums.Rol;
        mustChangePassword: boolean;
        onboardingCompletado: boolean;
        activo: boolean;
    }, "password"> & {
        iglesia: {
            nombre: string;
            logoUrl: string | null;
        } | null;
    } & {
        requiresPasswordChange: boolean;
        requiresOnboarding: boolean;
    }>;
    changePassword(user: JwtPayload, dto: ChangePasswordDto): Promise<void>;
}
