import {
  DIAS_POR_PERIODO_FALLBACK,
  buildAlertasPeriodos,
  calcularPeriodosAdquiridos,
  diasPorPeriodoVacaciones,
  periodosCubiertosPorLegacy,
  periodoIdDesdeIndice,
} from './adquisicion-vacaciones';

describe('adquisicion-vacaciones', () => {
  it('calcula días por periodo según jornada habitual', () => {
    expect(diasPorPeriodoVacaciones(6)).toBe(12);
    expect(diasPorPeriodoVacaciones(5)).toBe(10);
    expect(diasPorPeriodoVacaciones(null)).toBe(DIAS_POR_PERIODO_FALLBACK);
  });

  it('no adquiere periodos sin 50 semanas', () => {
    const ahora = new Date('2024-06-01T12:00:00-06:00');
    expect(calcularPeriodosAdquiridos('2024-01-01', 6, ahora)).toEqual([]);
  });

  it('adquiere P1 tras 50 semanas desde el ingreso', () => {
    // 50*7 = 350 días → 2023-01-01 + 350 = 2023-12-17
    const ahora = new Date('2024-01-01T12:00:00-06:00');
    const periodos = calcularPeriodosAdquiridos('2023-01-01', 6, ahora);
    expect(periodos.length).toBeGreaterThanOrEqual(1);
    expect(periodos[0]).toMatchObject({
      periodoId: 'P1',
      indice: 1,
      cantidadDias: 12,
      fechaInicioPeriodo: '2023-01-01',
      fechaAdquisicion: '2023-12-17',
    });
  });

  it('protege legacy: periodos cubiertos por acumulados sin periodoId', () => {
    expect(periodosCubiertosPorLegacy(24, 12)).toBe(2);
    expect(periodosCubiertosPorLegacy(11, 12)).toBe(0);
  });

  it('periodoId estable', () => {
    expect(periodoIdDesdeIndice(3)).toBe('P3');
  });

  it('emite alerta de plazo cuando venció el otorgamiento', () => {
    const ahora = new Date('2025-06-01T12:00:00-06:00');
    const alertas = buildAlertasPeriodos(
      [{ periodoId: 'P1', fechaAdquisicion: '2023-12-17' }],
      12,
      ahora,
    );
    expect(alertas.some((a) => a.tipo === 'PLAZO_LEGAL_OTORGAMIENTO')).toBe(
      true,
    );
    expect(alertas.some((a) => a.tipo === 'PERIODO_PENDIENTE_DISFRUTE')).toBe(
      true,
    );
  });
});
