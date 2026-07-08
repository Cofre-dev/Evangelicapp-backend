"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const BCRYPT_ROUNDS = 10;
let AuthService = class AuthService {
    constructor(prisma, jwtService, config) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.config = config;
    }
    async validateUser(username, password) {
        const usuario = await this.prisma.usuario.findUnique({ where: { username } });
        if (!usuario || !usuario.activo) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const passwordMatches = await bcrypt.compare(password, usuario.password);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        return usuario;
    }
    async login(usuario) {
        const tokens = await this.issueTokens(usuario);
        return {
            ...tokens,
            usuario: await this.attachIglesia(usuario),
            requiresPasswordChange: usuario.mustChangePassword,
            requiresOnboarding: !usuario.onboardingCompletado,
        };
    }
    async getProfile(usuarioId) {
        const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
        if (!usuario) {
            throw new common_1.UnauthorizedException();
        }
        return {
            ...(await this.attachIglesia(usuario)),
            requiresPasswordChange: usuario.mustChangePassword,
            requiresOnboarding: !usuario.onboardingCompletado,
        };
    }
    async refreshTokens(payload) {
        const tokenHash = this.hashToken(payload.refreshToken);
        const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
        if (!stored ||
            stored.revoked ||
            stored.usuarioId !== payload.sub ||
            stored.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Refresh token inválido o expirado');
        }
        const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
        if (!usuario || !usuario.activo) {
            throw new common_1.UnauthorizedException('Usuario inválido o inactivo');
        }
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revoked: true },
        });
        return this.issueTokens(usuario);
    }
    async logout(usuarioId) {
        await this.prisma.refreshToken.updateMany({
            where: { usuarioId, revoked: false },
            data: { revoked: true },
        });
    }
    async changePassword(usuarioId, dto) {
        const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
        if (!usuario) {
            throw new common_1.UnauthorizedException();
        }
        const passwordMatches = await bcrypt.compare(dto.currentPassword, usuario.password);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('La contraseña actual no es correcta');
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
    async verifyPassword(usuarioId, password) {
        const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
        if (!usuario) {
            throw new common_1.UnauthorizedException();
        }
        const passwordMatches = await bcrypt.compare(password, usuario.password);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('Contraseña incorrecta');
        }
    }
    async issueTokens(usuario) {
        const payload = {
            sub: usuario.id,
            email: usuario.email,
            rol: usuario.rol,
            iglesiaId: usuario.iglesiaId,
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
                expiresIn: this.config.get('JWT_ACCESS_EXPIRATION', '15m'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
                expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
            }),
        ]);
        const decoded = this.jwtService.decode(refreshToken);
        await this.prisma.refreshToken.create({
            data: {
                tokenHash: this.hashToken(refreshToken),
                usuarioId: usuario.id,
                expiresAt: new Date(decoded.exp * 1000),
            },
        });
        return { accessToken, refreshToken };
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    async attachIglesia(usuario) {
        const iglesia = usuario.iglesiaId
            ? await this.prisma.iglesia.findUnique({
                where: { id: usuario.iglesiaId },
                select: { nombre: true, logoUrl: true },
            })
            : null;
        const { password, ...safe } = usuario;
        return { ...safe, iglesia };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map