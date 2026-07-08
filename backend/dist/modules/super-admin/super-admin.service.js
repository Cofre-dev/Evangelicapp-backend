"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
let SuperAdminService = class SuperAdminService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboard() {
        const [iglesiasTotal, iglesiasActivas, pastoresTotal, porRegionRaw, iglesias] = await Promise.all([
            this.prisma.iglesia.count(),
            this.prisma.iglesia.count({ where: { estado: client_1.EstadoIglesia.ACTIVA } }),
            this.prisma.usuario.count({ where: { rol: client_1.Rol.PASTOR } }),
            this.prisma.iglesia.groupBy({ by: ['region'], _count: { _all: true } }),
            this.prisma.iglesia.findMany({
                select: {
                    id: true,
                    nombre: true,
                    comuna: true,
                    region: true,
                    logoUrl: true,
                    estado: true,
                    createdAt: true,
                    usuarios: {
                        where: { rol: client_1.Rol.PASTOR },
                        select: { nombre: true, apellido: true, email: true },
                        take: 1,
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        return {
            totales: { iglesias: iglesiasTotal, iglesiasActivas, pastores: pastoresTotal },
            porRegion: porRegionRaw
                .map((r) => ({ region: r.region, cantidad: r._count._all }))
                .sort((a, b) => b.cantidad - a.cantidad),
            iglesias: iglesias.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                comuna: i.comuna,
                region: i.region,
                logoUrl: i.logoUrl,
                estado: i.estado,
                createdAt: i.createdAt,
                pastor: i.usuarios[0] ?? null,
            })),
        };
    }
};
exports.SuperAdminService = SuperAdminService;
exports.SuperAdminService = SuperAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SuperAdminService);
//# sourceMappingURL=super-admin.service.js.map