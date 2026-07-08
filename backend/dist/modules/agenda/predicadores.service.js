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
exports.PredicadoresService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let PredicadoresService = class PredicadoresService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getInvitacion(token) {
        const predicador = await this.prisma.predicador.findUnique({
            where: { tokenConfirmacion: token },
            include: {
                evento: {
                    select: {
                        titulo: true,
                        fechaInicio: true,
                        fechaFin: true,
                        ubicacion: true,
                        iglesia: { select: { nombre: true, logoUrl: true } },
                    },
                },
            },
        });
        if (!predicador) {
            throw new common_1.NotFoundException('Invitación no encontrada');
        }
        return {
            nombre: predicador.nombre,
            email: predicador.email,
            estado: predicador.estado,
            respondidoAt: predicador.respondidoAt,
            evento: {
                titulo: predicador.evento.titulo,
                fechaInicio: predicador.evento.fechaInicio,
                fechaFin: predicador.evento.fechaFin,
                ubicacion: predicador.evento.ubicacion,
            },
            iglesia: predicador.evento.iglesia,
        };
    }
    async responder(token, respuesta) {
        const predicador = await this.prisma.predicador.findUnique({ where: { tokenConfirmacion: token } });
        if (!predicador) {
            throw new common_1.NotFoundException('Invitación no encontrada');
        }
        await this.prisma.predicador.update({
            where: { tokenConfirmacion: token },
            data: { estado: respuesta, respondidoAt: new Date() },
        });
        return this.getInvitacion(token);
    }
};
exports.PredicadoresService = PredicadoresService;
exports.PredicadoresService = PredicadoresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PredicadoresService);
//# sourceMappingURL=predicadores.service.js.map