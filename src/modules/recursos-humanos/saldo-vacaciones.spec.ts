import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import {
  calcularSaldoVacaciones,
  SIGNO_MOVIMIENTO_VACACIONES,
} from './saldo-vacaciones';

const { ACUMULADO, DISFRUTADO } = TipoMovimientoVacaciones;

describe('calcularSaldoVacaciones', () => {
  it('devuelve cero sin movimientos', () => {
    expect(calcularSaldoVacaciones([])).toEqual({
      diasAcumulados: 0,
      diasDisfrutados: 0,
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
      diasDisponibles: 6,
    });
  });

  it('coincide con el ejemplo del requerimiento (20 / 8 / 12)', () => {
    expect(
      calcularSaldoVacaciones([
        { tipo: ACUMULADO, cantidadDias: 15 },
        { tipo: ACUMULADO, cantidadDias: 5 },
        { tipo: DISFRUTADO, cantidadDias: 3 },
        { tipo: DISFRUTADO, cantidadDias: 5 },
      ]),
    ).toEqual({ diasAcumulados: 20, diasDisfrutados: 8, diasDisponibles: 12 });
  });

  it('el saldo se deriva del historial y no de un número guardado', () => {
    const historial = [{ tipo: ACUMULADO, cantidadDias: 10 }];
    expect(calcularSaldoVacaciones(historial).diasDisponibles).toBe(10);

    historial.push({ tipo: DISFRUTADO, cantidadDias: 4 });
    expect(calcularSaldoVacaciones(historial).diasDisponibles).toBe(6);

    historial.push({ tipo: ACUMULADO, cantidadDias: 1 });
    expect(calcularSaldoVacaciones(historial).diasDisponibles).toBe(7);
  });

  it('refleja un sobregiro como disponibles negativos (la capa de servicio lo impide)', () => {
    const saldo = calcularSaldoVacaciones([
      { tipo: ACUMULADO, cantidadDias: 2 },
      { tipo: DISFRUTADO, cantidadDias: 5 },
    ]);
    expect(saldo.diasDisponibles).toBe(-3);
  });

  it('define el signo de cada tipo', () => {
    expect(SIGNO_MOVIMIENTO_VACACIONES[ACUMULADO]).toBe(1);
    expect(SIGNO_MOVIMIENTO_VACACIONES[DISFRUTADO]).toBe(-1);
  });
});
