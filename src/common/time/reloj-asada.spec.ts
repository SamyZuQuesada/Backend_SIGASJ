import {
  anioEnAsada,
  fechaCalendarioEnAsada,
  finDiaEnAsada,
  inicioDiaEnAsada,
  inicioDiaSiguienteEnAsada,
} from './reloj-asada';

describe('reloj-asada: día calendario en Costa Rica (UTC-6)', () => {
  it('a las 20:35 del 17 en Costa Rica (02:35Z del 18) sigue siendo el día 17', () => {
    expect(fechaCalendarioEnAsada(new Date('2026-10-18T02:35:47.000Z'))).toBe(
      '2026-10-17',
    );
  });

  it('a las 00:00 y a las 23:59 de Costa Rica el día no cambia', () => {
    expect(fechaCalendarioEnAsada(new Date('2026-10-18T06:00:00.000Z'))).toBe(
      '2026-10-18',
    );
    expect(fechaCalendarioEnAsada(new Date('2026-10-19T05:59:59.999Z'))).toBe(
      '2026-10-18',
    );
    expect(fechaCalendarioEnAsada(new Date('2026-10-19T06:00:00.000Z'))).toBe(
      '2026-10-19',
    );
  });

  it('el año es el de Costa Rica en la noche del 31 de diciembre', () => {
    // 31/12/2026 20:00 en Costa Rica = 01/01/2027 02:00 UTC
    expect(anioEnAsada(new Date('2027-01-01T02:00:00.000Z'))).toBe(2026);
    expect(anioEnAsada(new Date('2027-01-01T06:00:00.000Z'))).toBe(2027);
  });

  it('el día empieza a las 06:00 UTC y termina un milisegundo antes del siguiente', () => {
    expect(inicioDiaEnAsada('2026-09-12').toISOString()).toBe(
      '2026-09-12T06:00:00.000Z',
    );
    expect(inicioDiaSiguienteEnAsada('2026-09-12').toISOString()).toBe(
      '2026-09-13T06:00:00.000Z',
    );
    expect(finDiaEnAsada('2026-09-12').toISOString()).toBe(
      '2026-09-13T05:59:59.999Z',
    );
  });

  it('cruza fin de mes y de año sin errores', () => {
    expect(inicioDiaSiguienteEnAsada('2026-12-31').toISOString()).toBe(
      '2027-01-01T06:00:00.000Z',
    );
    expect(inicioDiaSiguienteEnAsada('2028-02-28').toISOString()).toBe(
      '2028-02-29T06:00:00.000Z',
    );
  });

  it('rechaza textos que no son una fecha y fechas imposibles', () => {
    expect(() => inicioDiaEnAsada('18/10/2026')).toThrow();
    expect(() => inicioDiaEnAsada('2026-02-30')).toThrow();
    expect(() => inicioDiaEnAsada('2026-13-01')).toThrow();
    expect(() => inicioDiaSiguienteEnAsada('2026-04-31')).toThrow();
  });
});
