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
exports.EventosService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const mail_service_1 = require("../mail/mail.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let EventosService = class EventosService {
    constructor(prisma, mailService) {
        this.prisma = prisma;
        this.mailService = mailService;
    }
    async findAll(iglesiaId, from, to) {
        return this.prisma.evento.findMany({
            where: {
                iglesiaId,
                ...(from && to ? { fechaInicio: { gte: from, lte: to } } : {}),
            },
            include: { predicadores: true },
            orderBy: { fechaInicio: 'asc' },
        });
    }
    async findOne(iglesiaId, id) {
        const evento = await this.prisma.evento.findFirst({
            where: { id, iglesiaId },
            include: { predicadores: true },
        });
        if (!evento) {
            throw new common_1.NotFoundException('Evento no encontrado');
        }
        return evento;
    }
    async create(iglesiaId, usuarioId, dto) {
        const fechaInicio = new Date(dto.fechaInicio);
        const fechaFin = new Date(dto.fechaFin);
        this.validarFechas(fechaInicio, fechaFin, { validarNoPasado: true });
        const evento = await this.prisma.evento.create({
            data: {
                titulo: dto.titulo,
                descripcion: dto.descripcion,
                tipo: dto.tipo,
                fechaInicio,
                fechaFin,
                ubicacion: dto.ubicacion,
                colorEtiqueta: dto.colorEtiqueta,
                iglesiaId,
                creadoPorId: usuarioId,
            },
        });
        if (dto.tipo === client_1.TipoEvento.CULTO && dto.predicadores?.length) {
            await this.invitarPredicadores(iglesiaId, evento, dto.predicadores);
        }
        return this.findOne(iglesiaId, evento.id);
    }
    async update(iglesiaId, id, dto) {
        const existente = await this.findOne(iglesiaId, id);
        const nuevaFechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : existente.fechaInicio;
        const nuevaFechaFin = dto.fechaFin ? new Date(dto.fechaFin) : existente.fechaFin;
        const cambiaFechaInicio = dto.fechaInicio !== undefined && nuevaFechaInicio.getTime() !== existente.fechaInicio.getTime();
        this.validarFechas(nuevaFechaInicio, nuevaFechaFin, { validarNoPasado: cambiaFechaInicio });
        return this.prisma.evento.update({
            where: { id },
            data: {
                ...dto,
                fechaInicio: dto.fechaInicio ? nuevaFechaInicio : undefined,
                fechaFin: dto.fechaFin ? nuevaFechaFin : undefined,
            },
            include: { predicadores: true },
        });
    }
    validarFechas(fechaInicio, fechaFin, opciones) {
        if (fechaFin <= fechaInicio) {
            throw new common_1.BadRequestException('La hora de término debe ser posterior a la hora de inicio');
        }
        if (opciones.validarNoPasado) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const fechaSolo = new Date(fechaInicio);
            fechaSolo.setHours(0, 0, 0, 0);
            if (fechaSolo < hoy) {
                throw new common_1.BadRequestException('No se pueden agendar eventos en fechas anteriores a hoy');
            }
        }
    }
    async remove(iglesiaId, id) {
        await this.findOne(iglesiaId, id);
        await this.prisma.evento.delete({ where: { id } });
    }
    async invitarPredicadores(iglesiaId, evento, predicadores) {
        const iglesia = await this.prisma.iglesia.findUnique({
            where: { id: iglesiaId },
            select: { nombre: true },
        });
        for (const invitado of predicadores) {
            const predicador = await this.prisma.predicador.create({
                data: { eventoId: evento.id, email: invitado.email, nombre: invitado.nombre },
            });
            await this.mailService.enviarInvitacionPredicador({
                email: predicador.email,
                nombreIglesia: iglesia?.nombre ?? 'tu iglesia',
                tituloEvento: evento.titulo,
                fecha: evento.fechaInicio,
                tokenConfirmacion: predicador.tokenConfirmacion,
            });
        }
    }
};
exports.EventosService = EventosService;
exports.EventosService = EventosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mail_service_1.MailService])
], EventosService);
//# sourceMappingURL=eventos.service.js.map