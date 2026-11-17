import {
  diasVacacionesNetosPorJornada,
  esDiaDeJornadaHabitual,
} from './dias-laborales-vacaciones';

describe('dias-laborales-vacaciones', () => {
  it('Lun–Vie con 5 días habituales', () => {
    expect(esDiaDeJornadaHabitual('2026-03-16', 5)).toBe(true); // lun
    expect(esDiaDeJornadaHabitual('2026-03-21', 5)).toBe(false); // sáb
    expect(esDiaDeJornadaHabitual('2026-03-22', 5)).toBe(false); // dom
  });

  it('cuenta solo días de jornada menos feriados', () => {
    // Semana Lun 16–Vie 20 mar 2026 = 5 días laborales
    expect(diasVacacionesNetosPorJornada('2026-03-16', '2026-03-20', 5)).toBe(5);
    // Incluye sábado → sigue 5 con jornada 5
    expect(diasVacacionesNetosPorJornada('2026-03-16', '2026-03-21', 5)).toBe(5);
    // Jornada 6 incluye sábado
    expect(diasVacacionesNetosPorJornada('2026-03-16', '2026-03-21', 6)).toBe(6);
  });
});
