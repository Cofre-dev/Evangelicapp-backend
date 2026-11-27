import { PlanIglesia, TipoNecesidad } from '@prisma/client';
import { resolverComuna } from '../../common/constants/chile-regiones';
import { estadoFacturacionDe } from '../../common/utils/calcular-facturacion';
import { calcularProgreso, coberturaCompleta } from './red.util';

const necesidad = (id: string, cantidadMeta: number | null) => ({
  id,
  descripcion: `Necesidad ${id}`,
  tipo: TipoNecesidad.VOLUNTARIOS,
  cantidadMeta,
  unidad: 'personas',
  orden: 0,
});

describe('red.util', () => {
  it('suma lo comprometido por necesidad y cuenta iglesias distintas', () => {
    const progreso = calcularProgreso(
      [necesidad('n1', 10), necesidad('n2', null)],
      [
        { iglesiaId: 'a', necesidadId: 'n1', cantidad: 4 },
        { iglesiaId: 'b', necesidadId: 'n1', cantidad: 6 },
        { iglesiaId: 'b', necesidadId: 'n2', cantidad: null },
        { iglesiaId: 'c', necesidadId: null, cantidad: 3 },
      ],
    );
    expect(progreso[0]).toMatchObject({ comprometido: 10, iglesias: 2, cubierta: true });
    // Sin meta numérica nunca queda "cubierta" sola.
    expect(progreso[1]).toMatchObject({ comprometido: 0, iglesias: 1, cubierta: false });
  });

  it('coberturaCompleta: solo cuentan las necesidades con meta', () => {
    expect(
      coberturaCompleta([necesidad('n1', 5)], [{ iglesiaId: 'a', necesidadId: 'n1', cantidad: 5 }]),
    ).toBe(true);
    expect(
      coberturaCompleta([necesidad('n1', 5)], [{ iglesiaId: 'a', necesidadId: 'n1', cantidad: 4 }]),
    ).toBe(false);
    expect(coberturaCompleta([necesidad('n1', null)], [])).toBeNull();
    expect(coberturaCompleta([], [])).toBeNull();
  });
});

describe('resolverComuna', () => {
  it('tolera mayúsculas, tildes, ñ y espacios y devuelve el nombre canónico', () => {
    expect(resolverComuna(' METROPOLITANA', ' nunoa ')).toEqual({
      region: 'Metropolitana',
      comuna: 'Ñuñoa',
    });
  });

  it('rechaza una comuna de otra región o inexistente', () => {
    expect(resolverComuna('Valparaíso', 'Ñuñoa')).toBeNull();
    expect(resolverComuna('Narnia', 'Ñuñoa')).toBeNull();
  });
});

describe('estadoFacturacionDe', () => {
  const ahora = new Date('2026-11-27T12:00:00Z');

  it('es null en plan GRATUITO aunque quede una fecha de cuando pagaba', () => {
    expect(estadoFacturacionDe(PlanIglesia.GRATUITO, new Date('2026-11-01T00:00:00Z'), ahora)).toBeNull();
  });

  it('es null si nunca tuvo fecha de facturación', () => {
    expect(estadoFacturacionDe(PlanIglesia.BASICO, null, ahora)).toBeNull();
  });

  it('calcula el semáforo en planes de pago', () => {
    const estado = estadoFacturacionDe(PlanIglesia.PRO, new Date('2026-11-23T00:00:00Z'), ahora);
    expect(estado).toMatchObject({ enMora: true, diasEnMora: 4, puedeOcultar: true });
  });
});
