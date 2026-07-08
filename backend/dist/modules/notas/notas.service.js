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
exports.NotasService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const NOTA_INCLUDE = {
    creadoPor: { select: { nombre: true, apellido: true } },
    asignadoA: { select: { id: true, nombre: true, apellido: true } },
};
let NotasService = class NotasService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(iglesiaId) {
        return this.prisma.nota.findMany({
            where: { iglesiaId },
            include: NOTA_INCLUDE,
            orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'desc' }],
        });
    }
    async findMisTareas(iglesiaId, usuarioId) {
        return this.prisma.nota.findMany({
            where: {
                iglesiaId,
                asignadoAId: usuarioId,
                tipo: client_1.TipoNota.RECORDATORIO,
                estado: { not: client_1.EstadoTarea.COMPLETADA },
            },
            include: NOTA_INCLUDE,
            orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'desc' }],
        });
    }
    async findOne(iglesiaId, id) {
        const nota = await this.prisma.nota.findFirst({
            where: { id, iglesiaId },
            include: NOTA_INCLUDE,
        });
        if (!nota) {
            throw new common_1.NotFoundException('Nota no encontrada');
        }
        return nota;
    }
    async create(iglesiaId, usuarioId, dto) {
        if (dto.asignadoAId) {
            await this.usuarioDeLaIglesiaOrThrow(iglesiaId, dto.asignadoAId);
        }
        return this.prisma.nota.create({
            data: {
                tipo: dto.tipo ?? client_1.TipoNota.RECORDATORIO,
                titulo: dto.titulo,
                descripcion: dto.descripcion,
                fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : undefined,
                iglesiaId,
                creadoPorId: usuarioId,
                asignadoAId: dto.asignadoAId,
            },
            include: NOTA_INCLUDE,
        });
    }
    async update(iglesiaId, id, dto) {
        await this.findOne(iglesiaId, id);
        if (dto.asignadoAId) {
            await this.usuarioDeLaIglesiaOrThrow(iglesiaId, dto.asignadoAId);
        }
        return this.prisma.nota.update({
            where: { id },
            data: {
                titulo: dto.titulo,
                descripcion: dto.descripcion,
                fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : undefined,
                asignadoAId: dto.asignadoAId === null ? null : dto.asignadoAId,
                estado: dto.estado,
            },
            include: NOTA_INCLUDE,
        });
    }
    async marcarHecha(iglesiaId, usuarioId, id) {
        const nota = await this.prisma.nota.findFirst({ where: { id, iglesiaId, asignadoAId: usuarioId } });
        if (!nota) {
            throw new common_1.NotFoundException('Tarea no encontrada');
        }
        if (nota.estado !== client_1.EstadoTarea.PENDIENTE) {
            throw new common_1.ForbiddenException('Esta tarea ya fue marcada o completada');
        }
        return this.prisma.nota.update({
            where: { id },
            data: { estado: client_1.EstadoTarea.EN_REVISION },
            include: NOTA_INCLUDE,
        });
    }
    async remove(iglesiaId, id) {
        await this.findOne(iglesiaId, id);
        await this.prisma.nota.delete({ where: { id } });
    }
    async usuarioDeLaIglesiaOrThrow(iglesiaId, usuarioId) {
        const usuario = await this.prisma.usuario.findFirst({
            where: { id: usuarioId, iglesiaId },
            select: { id: true },
        });
        if (!usuario) {
            throw new common_1.NotFoundException('Usuario asignado no encontrado');
        }
        return usuario;
    }
};
exports.NotasService = NotasService;
exports.NotasService = NotasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotasService);
//# sourceMappingURL=notas.service.js.map