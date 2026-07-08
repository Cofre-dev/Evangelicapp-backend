import { StreamableFile } from '@nestjs/common';
import { TipoMovimiento } from '@prisma/client';
import type { Response } from 'express';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';
import { MovimientosService } from './movimientos.service';
export declare class MovimientosController {
    private readonly movimientosService;
    constructor(movimientosService: MovimientosService);
    findAll(user: JwtPayload, from?: string, to?: string, tipo?: TipoMovimiento): Promise<({
        creadoPor: {
            nombre: string;
            apellido: string;
        } | null;
        categoria: {
            nombre: string;
            tipo: import(".prisma/client").$Enums.TipoMovimiento;
            id: string;
            createdAt: Date;
            iglesiaId: string;
        };
    } & {
        descripcion: string;
        tipo: import(".prisma/client").$Enums.TipoMovimiento;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string | null;
        monto: import("@prisma/client/runtime/library").Decimal;
        categoriaId: string;
        fecha: Date;
        medioPago: import(".prisma/client").$Enums.MedioPago;
    })[]>;
    dashboard(user: JwtPayload, from?: string, to?: string): Promise<import("./movimientos.service").FinanzasDashboard>;
    logs(user: JwtPayload): Promise<({
        usuario: {
            nombre: string;
            apellido: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        iglesiaId: string;
        usuarioId: string | null;
        accion: import(".prisma/client").$Enums.AccionAuditoria;
        movimientoId: string;
        snapshot: import("@prisma/client/runtime/library").JsonValue;
    })[]>;
    exportar(user: JwtPayload, res: Response, from?: string, to?: string): Promise<StreamableFile>;
    create(user: JwtPayload, dto: CreateMovimientoDto): Promise<{
        creadoPor: {
            nombre: string;
            apellido: string;
        } | null;
        categoria: {
            nombre: string;
            tipo: import(".prisma/client").$Enums.TipoMovimiento;
            id: string;
            createdAt: Date;
            iglesiaId: string;
        };
    } & {
        descripcion: string;
        tipo: import(".prisma/client").$Enums.TipoMovimiento;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string | null;
        monto: import("@prisma/client/runtime/library").Decimal;
        categoriaId: string;
        fecha: Date;
        medioPago: import(".prisma/client").$Enums.MedioPago;
    }>;
    update(user: JwtPayload, id: string, dto: UpdateMovimientoDto): Promise<{
        creadoPor: {
            nombre: string;
            apellido: string;
        } | null;
        categoria: {
            nombre: string;
            tipo: import(".prisma/client").$Enums.TipoMovimiento;
            id: string;
            createdAt: Date;
            iglesiaId: string;
        };
    } & {
        descripcion: string;
        tipo: import(".prisma/client").$Enums.TipoMovimiento;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string;
        creadoPorId: string | null;
        monto: import("@prisma/client/runtime/library").Decimal;
        categoriaId: string;
        fecha: Date;
        medioPago: import(".prisma/client").$Enums.MedioPago;
    }>;
    remove(user: JwtPayload, id: string, dto: ConfirmPasswordDto): Promise<void>;
    private requireIglesiaId;
}
