import { BadRequestException } from '@nestjs/common';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import {
  AVERIA_ASIGNADA_SIN_FONTANERO,
  AVERIA_EN_ATENCION_SIN_FONTANERO,
  assertEstadoAveriaCompatibleConFontanero,
  assertTransicionEstadoAveria,
  esTransicionEstadoAveriaValida,
  mensajeTransicionEstadoAveriaInvalida,
  TRANSICIONES_ESTADO_AVERIA,
} from './averias.estado-transiciones';

describe('transiciones de estado de avería (PBI 2.3 / 2.4)', () => {
  it('permite EN_REVISION → ASIGNADA y PENDIENTE → ASIGNADA', () => {
    expect(
      esTransicionEstadoAveriaValida(
        EstadoAveria.EN_REVISION,
        EstadoAveria.ASIGNADA,
      ),
    ).toBe(true);
    expect(
      esTransicionEstadoAveriaValida(
        EstadoAveria.PENDIENTE,
        EstadoAveria.ASIGNADA,
      ),
    ).toBe(true);
  });

  it('rechaza RECIBIDA → ASIGNADA y RESUELTA → ASIGNADA', () => {
    expect(
      esTransicionEstadoAveriaValida(
        EstadoAveria.RECIBIDA,
        EstadoAveria.ASIGNADA,
      ),
    ).toBe(false);
    expect(
      esTransicionEstadoAveriaValida(
        EstadoAveria.RESUELTA,
        EstadoAveria.ASIGNADA,
      ),
    ).toBe(false);
    expect(TRANSICIONES_ESTADO_AVERIA[EstadoAveria.CANCELADA]).toEqual([]);
  });

  it('exige fontanero para ASIGNADA y EN_ATENCION, no para PENDIENTE', () => {
    expect(() =>
      assertEstadoAveriaCompatibleConFontanero(EstadoAveria.ASIGNADA, null),
    ).toThrow(AVERIA_ASIGNADA_SIN_FONTANERO);
    expect(() =>
      assertEstadoAveriaCompatibleConFontanero(EstadoAveria.EN_ATENCION, null),
    ).toThrow(AVERIA_EN_ATENCION_SIN_FONTANERO);
    expect(() =>
      assertEstadoAveriaCompatibleConFontanero(EstadoAveria.PENDIENTE, null),
    ).not.toThrow();
    expect(() =>
      assertEstadoAveriaCompatibleConFontanero(EstadoAveria.ASIGNADA, 7),
    ).not.toThrow();
  });

  it('lanza BadRequestException con mensaje claro', () => {
    expect(() =>
      assertTransicionEstadoAveria(
        EstadoAveria.RECIBIDA,
        EstadoAveria.ASIGNADA,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertTransicionEstadoAveria(
        EstadoAveria.RECIBIDA,
        EstadoAveria.ASIGNADA,
      ),
    ).toThrow(
      mensajeTransicionEstadoAveriaInvalida(
        EstadoAveria.RECIBIDA,
        EstadoAveria.ASIGNADA,
      ),
    );
  });
});
