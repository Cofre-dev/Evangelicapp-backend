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
exports.IglesiasService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const generate_temporary_password_1 = require("../../common/utils/generate-temporary-password");
const translate_unique_constraint_error_1 = require("../../common/utils/translate-unique-constraint-error");
const prisma_service_1 = require("../../prisma/prisma.service");
const BCRYPT_ROUNDS = 10;
let IglesiasService = class IglesiasService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto, logo) {
        const temporaryPassword = (0, generate_temporary_password_1.generateTemporaryPassword)();
        const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
        try {
            const { iglesia, pastor } = await this.prisma.$transaction(async (tx) => {
                const iglesia = await tx.iglesia.create({
                    data: {
                        nombre: dto.nombre,
                        comuna: dto.comuna,
                        region: dto.region,
                        direccion: dto.direccion,
                        logoUrl: logo ? `/uploads/logos/${logo.filename}` : undefined,
                    },
                });
                const pastor = await tx.usuario.create({
                    data: {
                        username: dto.pastorUsername,
                        email: dto.pastorEmail,
                        password: passwordHash,
                        nombre: dto.pastorNombre,
                        apellido: dto.pastorApellido,
                        rol: client_1.Rol.PASTOR,
                        iglesiaId: iglesia.id,
                        mustChangePassword: true,
                        onboardingCompletado: false,
                    },
                    select: { id: true, username: true, email: true, nombre: true, apellido: true },
                });
                return { iglesia, pastor };
            });
            return { iglesia, pastor, temporaryPassword };
        }
        catch (error) {
            throw (0, translate_unique_constraint_error_1.translateUniqueConstraintError)(error);
        }
    }
    async findOne(id) {
        const iglesia = await this.prisma.iglesia.findUnique({
            where: { id },
            select: {
                id: true,
                nombre: true,
                comuna: true,
                region: true,
                direccion: true,
                logoUrl: true,
                estado: true,
                visitantesPromedio: true,
                createdAt: true,
                usuarios: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        nombre: true,
                        apellido: true,
                        rol: true,
                        activo: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!iglesia) {
            throw new common_1.NotFoundException('Iglesia no encontrada');
        }
        const { usuarios, ...iglesiaData } = iglesia;
        return {
            ...iglesiaData,
            pastor: usuarios.find((u) => u.rol === client_1.Rol.PASTOR) ?? null,
            equipo: usuarios.filter((u) => u.rol !== client_1.Rol.PASTOR),
        };
    }
};
exports.IglesiasService = IglesiasService;
exports.IglesiasService = IglesiasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IglesiasService);
//# sourceMappingURL=iglesias.service.js.map