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
exports.MovimientosService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ExcelJS = __importStar(require("exceljs"));
const auth_service_1 = require("../auth/auth.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const MEDIO_PAGO_LABEL = {
    EFECTIVO: 'Efectivo',
    TRANSFERENCIA: 'Transferencia',
};
let MovimientosService = class MovimientosService {
    constructor(prisma, authService) {
        this.prisma = prisma;
        this.authService = authService;
    }
    async findAll(iglesiaId, from, to, tipo) {
        return this.prisma.movimientoFinanciero.findMany({
            where: {
                iglesiaId,
                ...(tipo ? { tipo } : {}),
                ...(from && to ? { fecha: { gte: from, lte: to } } : {}),
            },
            include: { categoria: true, creadoPor: { select: { nombre: true, apellido: true } } },
            orderBy: { fecha: 'desc' },
        });
    }
    async findOne(iglesiaId, id) {
        const movimiento = await this.prisma.movimientoFinanciero.findFirst({
            where: { id, iglesiaId },
            include: { categoria: true, creadoPor: { select: { nombre: true, apellido: true } } },
        });
        if (!movimiento) {
            throw new common_1.NotFoundException('Movimiento no encontrado');
        }
        return movimiento;
    }
    async create(iglesiaId, usuarioId, dto) {
        const categoria = await this.categoriaDeLaIglesiaOrThrow(iglesiaId, dto.categoriaId);
        const movimiento = await this.prisma.movimientoFinanciero.create({
            data: {
                tipo: categoria.tipo,
                monto: dto.monto,
                fecha: new Date(dto.fecha),
                descripcion: dto.descripcion,
                medioPago: dto.medioPago,
                categoriaId: categoria.id,
                iglesiaId,
                creadoPorId: usuarioId,
            },
            include: { categoria: true, creadoPor: { select: { nombre: true, apellido: true } } },
        });
        await this.registrarAuditoria(iglesiaId, usuarioId, movimiento.id, client_1.AccionAuditoria.CREACION, movimiento);
        return movimiento;
    }
    async update(iglesiaId, id, usuarioId, dto) {
        await this.findOne(iglesiaId, id);
        const categoria = dto.categoriaId
            ? await this.categoriaDeLaIglesiaOrThrow(iglesiaId, dto.categoriaId)
            : undefined;
        const movimiento = await this.prisma.movimientoFinanciero.update({
            where: { id },
            data: {
                monto: dto.monto,
                fecha: dto.fecha ? new Date(dto.fecha) : undefined,
                descripcion: dto.descripcion,
                medioPago: dto.medioPago,
                categoriaId: categoria?.id,
                tipo: categoria?.tipo,
            },
            include: { categoria: true, creadoPor: { select: { nombre: true, apellido: true } } },
        });
        await this.registrarAuditoria(iglesiaId, usuarioId, movimiento.id, client_1.AccionAuditoria.EDICION, movimiento);
        return movimiento;
    }
    async remove(iglesiaId, id, usuarioId, dto) {
        await this.authService.verifyPassword(usuarioId, dto.password);
        const movimiento = await this.findOne(iglesiaId, id);
        await this.prisma.movimientoFinanciero.delete({ where: { id } });
        await this.registrarAuditoria(iglesiaId, usuarioId, id, client_1.AccionAuditoria.ELIMINACION, movimiento);
    }
    async logs(iglesiaId) {
        return this.prisma.movimientoAuditLog.findMany({
            where: { iglesiaId },
            include: { usuario: { select: { nombre: true, apellido: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async dashboard(iglesiaId, from, to) {
        const movimientos = await this.prisma.movimientoFinanciero.findMany({
            where: { iglesiaId, ...(from && to ? { fecha: { gte: from, lte: to } } : {}) },
            include: { categoria: true },
        });
        const ingresos = movimientos.filter((m) => m.tipo === client_1.TipoMovimiento.INGRESO);
        const egresos = movimientos.filter((m) => m.tipo === client_1.TipoMovimiento.EGRESO);
        const totalIngresos = ingresos.reduce((suma, m) => suma + Number(m.monto), 0);
        const totalEgresos = egresos.reduce((suma, m) => suma + Number(m.monto), 0);
        return {
            totales: { ingresos: totalIngresos, egresos: totalEgresos, balance: totalIngresos - totalEgresos },
            porCategoriaIngreso: this.agruparPorCategoria(ingresos),
            porCategoriaEgreso: this.agruparPorCategoria(egresos),
        };
    }
    async exportar(iglesiaId, from, to) {
        const movimientos = await this.findAll(iglesiaId, from, to);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Movimientos');
        sheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'Tipo', key: 'tipo', width: 12 },
            { header: 'Categoría', key: 'categoria', width: 24 },
            { header: 'Medio de pago', key: 'medioPago', width: 16 },
            { header: 'Monto', key: 'monto', width: 16 },
            { header: 'Descripción', key: 'descripcion', width: 34 },
        ];
        sheet.getRow(1).font = { bold: true };
        sheet.getColumn('monto').numFmt = '#,##0';
        let totalIngresos = 0;
        let totalEgresos = 0;
        for (const m of movimientos) {
            const monto = Number(m.monto);
            if (m.tipo === client_1.TipoMovimiento.INGRESO)
                totalIngresos += monto;
            else
                totalEgresos += monto;
            sheet.addRow({
                fecha: m.fecha.toLocaleDateString('es-CL'),
                tipo: m.tipo === client_1.TipoMovimiento.INGRESO ? 'Ingreso' : 'Egreso',
                categoria: m.categoria.nombre,
                medioPago: MEDIO_PAGO_LABEL[m.medioPago],
                monto,
                descripcion: m.descripcion,
            });
        }
        sheet.addRow({});
        const filaIngresos = sheet.addRow({ categoria: 'Total ingresos', monto: totalIngresos });
        const filaEgresos = sheet.addRow({ categoria: 'Total egresos', monto: totalEgresos });
        const filaBalance = sheet.addRow({ categoria: 'Balance', monto: totalIngresos - totalEgresos });
        [filaIngresos, filaEgresos, filaBalance].forEach((fila) => (fila.font = { bold: true }));
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    agruparPorCategoria(movimientos) {
        const totales = new Map();
        for (const m of movimientos) {
            const actual = totales.get(m.categoria.nombre) ?? 0;
            totales.set(m.categoria.nombre, actual + Number(m.monto));
        }
        return [...totales.entries()]
            .map(([categoria, total]) => ({ categoria, total }))
            .sort((a, b) => b.total - a.total);
    }
    async categoriaDeLaIglesiaOrThrow(iglesiaId, categoriaId) {
        const categoria = await this.prisma.categoriaFinanciera.findFirst({
            where: { id: categoriaId, iglesiaId },
        });
        if (!categoria) {
            throw new common_1.NotFoundException('Categoría no encontrada');
        }
        return categoria;
    }
    async registrarAuditoria(iglesiaId, usuarioId, movimientoId, accion, movimiento) {
        await this.prisma.movimientoAuditLog.create({
            data: {
                iglesiaId,
                usuarioId,
                movimientoId,
                accion,
                snapshot: {
                    tipo: movimiento.tipo,
                    monto: Number(movimiento.monto),
                    descripcion: movimiento.descripcion,
                    medioPago: movimiento.medioPago,
                    fecha: movimiento.fecha.toISOString(),
                    categoria: movimiento.categoria.nombre,
                },
            },
        });
    }
};
exports.MovimientosService = MovimientosService;
exports.MovimientosService = MovimientosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService])
], MovimientosService);
//# sourceMappingURL=movimientos.service.js.map