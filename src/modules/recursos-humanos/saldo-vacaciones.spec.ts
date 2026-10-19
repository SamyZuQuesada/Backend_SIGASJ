import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { calcularSaldoVacaciones } from './saldo-vacaciones';

const { ACUMULADO, DISFRUTADO, AJUSTE } = TipoMovimientoVacaciones;

describe('calcularSaldoVacaciones', () => {
  it('devuelve cero sin movimientos', () => {
    expect(calcularSaldoVacaciones([])).toEqual({
      diasAcumulados: 0,
      diasDisfrutados: 0,
      diasAjusteNeto: 0,
      diasDisponibles: 0,
    });
  });

  it('suma acumulados y resta disfrutados', () => {
    const saldo = calcularSaldoVacaciones([
      { tipo: ACUMULADO, cantidadDias: 12 },
      { tipo: DISFRUTADO, cantidadDias: 3 },
      { tipo: ACUMULADO, cantidadDias: 2 },
      { tipo: DISFRUTADO, cantidadDias: 5 },
    ]);
    expect(saldo).toEqual({
      diasAcumulados: 14,
      diasDisfrutados: 8,
      diasAjusteNeto: 0,
      diasDisponibles: 6,
    });
  });

  it('aplica AJUSTE con signo', () => {
    const saldo = calcularSaldoVacaciones([
      { tipo: ACUMULADO, cantidadDias: 10 },
      { tipo: AJUSTE, cantidadDias: 2, signoAjuste: 1 },
      { tipo: AJUSTE, cantidadDias: 3, signoAjuste: -1 },
    ]);
    expect(saldo).toEqual({
      diasAcumulados: 10,
      diasDisfrutados: 0,
      diasAjusteNeto: -1,
      diasDisponibles: 9,
    });
  });

  it('el saldo se deriva del historial y no de un número guardado', () => {
    const historial = [{ tipo: ACUMULADO, cantidadDias: 10 }];
    expect(calcularSaldoVacaciones(historial).diasDisponibles).toBe(10);

    historial.push({ tipo: DISFRUTADO, cantidadDias: 4 });
    expect(calcularSaldoVacaciones(historial).diasDisponibles).toBe(6);

    historial.push({
      tipo: AJUSTE,
      cantidadDias: 1,
      signoAjuste: 1,
    });
    expect(calcularSaldoVacaciones(historial).diasDisponibles).toBe(7);
  });
});
