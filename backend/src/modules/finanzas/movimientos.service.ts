import { Injectable, NotFoundException } from '@nestjs/common';
import { AccionAuditoria, MedioPago, Prisma, TipoMovimiento } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';

export interface FinanzasDashboard {
  totales: { ingresos: number; egresos: number; balance: number };
  porCategoriaIngreso: { categoria: string; total: number }[];
  porCategoriaEgreso: { categoria: string; total: number }[];
}

const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
};

type MovimientoConCategoria = Prisma.MovimientoFinancieroGetPayload<{ include: { categoria: true } }>;

@Injectable()
export class MovimientosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(iglesiaId: string, from?: Date, to?: Date, tipo?: TipoMovimiento) {
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

  async findOne(iglesiaId: string, id: string) {
    const movimiento = await this.prisma.movimientoFinanciero.findFirst({
      where: { id, iglesiaId },
      include: { categoria: true, creadoPor: { select: { nombre: true, apellido: true } } },
    });

    if (!movimiento) {
      throw new NotFoundException('Movimiento no encontrado');
    }

    return movimiento;
  }

  async create(iglesiaId: string, usuarioId: string, dto: CreateMovimientoDto) {
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

    await this.registrarAuditoria(iglesiaId, usuarioId, movimiento.id, AccionAuditoria.CREACION, movimiento);

    return movimiento;
  }

  async update(iglesiaId: string, id: string, usuarioId: string, dto: UpdateMovimientoDto) {
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

    await this.registrarAuditoria(iglesiaId, usuarioId, movimiento.id, AccionAuditoria.EDICION, movimiento);

    return movimiento;
  }

  /** Exige confirmar la contraseña del usuario antes de eliminar: es una acción irreversible. */
  async remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void> {
    await this.authService.verifyPassword(usuarioId, dto.password);

    const movimiento = await this.findOne(iglesiaId, id);
    await this.prisma.movimientoFinanciero.delete({ where: { id } });
    await this.registrarAuditoria(iglesiaId, usuarioId, id, AccionAuditoria.ELIMINACION, movimiento);
  }

  async logs(iglesiaId: string) {
    return this.prisma.movimientoAuditLog.findMany({
      where: { iglesiaId },
      include: { usuario: { select: { nombre: true, apellido: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dashboard(iglesiaId: string, from?: Date, to?: Date): Promise<FinanzasDashboard> {
    const movimientos = await this.prisma.movimientoFinanciero.findMany({
      where: { iglesiaId, ...(from && to ? { fecha: { gte: from, lte: to } } : {}) },
      include: { categoria: true },
    });

    const ingresos = movimientos.filter((m) => m.tipo === TipoMovimiento.INGRESO);
    const egresos = movimientos.filter((m) => m.tipo === TipoMovimiento.EGRESO);

    const totalIngresos = ingresos.reduce((suma, m) => suma + Number(m.monto), 0);
    const totalEgresos = egresos.reduce((suma, m) => suma + Number(m.monto), 0);

    return {
      totales: { ingresos: totalIngresos, egresos: totalEgresos, balance: totalIngresos - totalEgresos },
      porCategoriaIngreso: this.agruparPorCategoria(ingresos),
      porCategoriaEgreso: this.agruparPorCategoria(egresos),
    };
  }

  async exportar(iglesiaId: string, from?: Date, to?: Date): Promise<Buffer> {
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
      if (m.tipo === TipoMovimiento.INGRESO) totalIngresos += monto;
      else totalEgresos += monto;

      sheet.addRow({
        fecha: m.fecha.toLocaleDateString('es-CL'),
        tipo: m.tipo === TipoMovimiento.INGRESO ? 'Ingreso' : 'Egreso',
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

  private agruparPorCategoria(
    movimientos: { categoria: { nombre: string }; monto: unknown }[],
  ): { categoria: string; total: number }[] {
    const totales = new Map<string, number>();

    for (const m of movimientos) {
      const actual = totales.get(m.categoria.nombre) ?? 0;
      totales.set(m.categoria.nombre, actual + Number(m.monto));
    }

    return [...totales.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  }

  private async categoriaDeLaIglesiaOrThrow(iglesiaId: string, categoriaId: string) {
    const categoria = await this.prisma.categoriaFinanciera.findFirst({
      where: { id: categoriaId, iglesiaId },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return categoria;
  }

  private async registrarAuditoria(
    iglesiaId: string,
    usuarioId: string,
    movimientoId: string,
    accion: AccionAuditoria,
    movimiento: MovimientoConCategoria,
  ): Promise<void> {
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
}
