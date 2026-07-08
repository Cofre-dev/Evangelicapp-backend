import { Prisma, TipoMovimiento } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';
export interface FinanzasDashboard {
    totales: {
        ingresos: number;
        egresos: number;
        balance: number;
    };
    porCategoriaIngreso: {
        categoria: string;
        total: number;
    }[];
    porCategoriaEgreso: {
        categoria: string;
        total: number;
    }[];
}
export declare class MovimientosService {
    private readonly prisma;
    private readonly authService;
    constructor(prisma: PrismaService, authService: AuthService);
    findAll(iglesiaId: string, from?: Date, to?: Date, tipo?: TipoMovimiento): Promise<({
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
        monto: Prisma.Decimal;
        categoriaId: string;
        fecha: Date;
        medioPago: import(".prisma/client").$Enums.MedioPago;
    })[]>;
    findOne(iglesiaId: string, id: string): Promise<{
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
        monto: Prisma.Decimal;
        categoriaId: string;
        fecha: Date;
        medioPago: import(".prisma/client").$Enums.MedioPago;
    }>;
    create(iglesiaId: string, usuarioId: string, dto: CreateMovimientoDto): Promise<{
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
        monto: Prisma.Decimal;
        categoriaId: string;
        fecha: Date;
        medioPago: import(".prisma/client").$Enums.MedioPago;
    }>;
    update(iglesiaId: string, id: string, usuarioId: string, dto: UpdateMovimientoDto): Promise<{
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
        monto: Prisma.Decimal;
        categoriaId: string;
        fecha: Date;
        medioPago: import(".prisma/client").$Enums.MedioPago;
    }>;
    remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void>;
    logs(iglesiaId: string): Promise<({
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
        snapshot: Prisma.JsonValue;
    })[]>;
    dashboard(iglesiaId: string, from?: Date, to?: Date): Promise<FinanzasDashboard>;
    exportar(iglesiaId: string, from?: Date, to?: Date): Promise<Buffer>;
    private agruparPorCategoria;
    private categoriaDeLaIglesiaOrThrow;
    private registrarAuditoria;
}
