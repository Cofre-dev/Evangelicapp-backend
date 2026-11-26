import { TipoMovimiento } from '@prisma/client';
import {
  OTROS_EGRESOS_LABEL,
  OTROS_INGRESOS_LABEL,
  construirReporte,
  esPeriodoEnviable,
  esPeriodoValido,
  nombrePeriodo,
  periodoAnterior,
  primerNombre,
  rangoPeriodo,
} from './reporte-congregacion.util';

describe('reporte-congregacion.util', () => {
  describe('períodos', () => {
    it('valida el formato YYYY-MM', () => {
      expect(esPeriodoValido('2026-10')).toBe(true);
      expect(esPeriodoValido('2026-13')).toBe(false);
      expect(esPeriodoValido('2026-1')).toBe(false);
      expect(esPeriodoValido('octubre')).toBe(false);
    });

    it('periodoAnterior cruza el cambio de año', () => {
      expect(periodoAnterior(new Date('2026-11-26T12:00:00Z'))).toBe('2026-10');
      expect(periodoAnterior(new Date('2027-01-01T13:00:00Z'))).toBe('2026-12');
    });

    it('rangoPeriodo devuelve [desde, hasta) en UTC', () => {
      const { desde, hasta } = rangoPeriodo('2026-12');
      expect(desde.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(hasta.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('solo permite enviar meses cerrados y de hasta 12 meses atrás', () => {
      const ahora = new Date('2026-11-26T12:00:00Z');
      expect(esPeriodoEnviable('2026-10', ahora)).toBe(true);
      expect(esPeriodoEnviable('2025-11', ahora)).toBe(true);
      expect(esPeriodoEnviable('2025-10', ahora)).toBe(false);
      expect(esPeriodoEnviable('2026-11', ahora)).toBe(false);
      expect(esPeriodoEnviable('2026-12', ahora)).toBe(false);
      expect(esPeriodoEnviable('basura', ahora)).toBe(false);
    });

    it('nombrePeriodo en español', () => {
      expect(nombrePeriodo('2026-10')).toBe('octubre de 2026');
    });
  });

  describe('construirReporte', () => {
    it('suma totales, agrupa por nombre y ordena de mayor a menor', () => {
      const reporte = construirReporte('2026-10', [
        { tipo: TipoMovimiento.INGRESO, categoria: 'Ofrendas', ocultaEnReporte: false, total: 100 },
        { tipo: TipoMovimiento.INGRESO, categoria: 'Diezmos', ocultaEnReporte: false, total: 500 },
        // Misma categoría por nombre en un departamento: se junta en una sola línea.
        { tipo: TipoMovimiento.INGRESO, categoria: 'Ofrendas', ocultaEnReporte: false, total: 50.5 },
        { tipo: TipoMovimiento.EGRESO, categoria: 'Arriendo', ocultaEnReporte: false, total: 300 },
      ]);

      expect(reporte.totales).toEqual({ ingresos: 650.5, egresos: 300, balance: 350.5 });
      expect(reporte.ingresosPorCategoria).toEqual([
        { categoria: 'Diezmos', total: 500 },
        { categoria: 'Ofrendas', total: 150.5 },
      ]);
      expect(reporte.egresosPorCategoria).toEqual([{ categoria: 'Arriendo', total: 300 }]);
    });

    it('las categorías ocultas van a "Otros" sin cambiar los totales', () => {
      const reporte = construirReporte('2026-10', [
        { tipo: TipoMovimiento.INGRESO, categoria: 'Diezmos', ocultaEnReporte: false, total: 500 },
        { tipo: TipoMovimiento.INGRESO, categoria: 'Donación especial', ocultaEnReporte: true, total: 200 },
        { tipo: TipoMovimiento.EGRESO, categoria: 'Ayuda social', ocultaEnReporte: true, total: 80 },
      ]);

      expect(reporte.totales).toEqual({ ingresos: 700, egresos: 80, balance: 620 });
      expect(reporte.ingresosPorCategoria).toEqual([
        { categoria: 'Diezmos', total: 500 },
        { categoria: OTROS_INGRESOS_LABEL, total: 200 },
      ]);
      expect(reporte.egresosPorCategoria).toEqual([{ categoria: OTROS_EGRESOS_LABEL, total: 80 }]);
      expect(JSON.stringify(reporte)).not.toContain('Donación especial');
    });

    it('un mes sin movimientos da todo en cero', () => {
      expect(construirReporte('2026-10', [])).toEqual({
        periodo: '2026-10',
        totales: { ingresos: 0, egresos: 0, balance: 0 },
        ingresosPorCategoria: [],
        egresosPorCategoria: [],
      });
    });
  });

  it('primerNombre', () => {
    expect(primerNombre('  María José Pérez ')).toBe('María');
  });
});
