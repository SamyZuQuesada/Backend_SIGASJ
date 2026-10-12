import { normalizarCedula } from './cedula.util';

describe('normalizarCedula (Utilidad)', () => {
  it('debe mantener una cédula nacional ya formateada', () => {
    expect(normalizarCedula('1-1234-0567')).toBe('1-1234-0567');
    expect(normalizarCedula('5-0123-0456')).toBe('5-0123-0456');
  });

  it('debe estandarizar cédulas nacionales sin guiones', () => {
    expect(normalizarCedula('112340567')).toBe('1-1234-0567');
    expect(normalizarCedula('501230456')).toBe('5-0123-0456');
    expect(normalizarCedula('529630157')).toBe('5-2963-0157');
    expect(normalizarCedula('102220999')).toBe('1-0222-0999');
  });

  it('debe limpiar espacios en blanco al inicio, al final y entre números o guiones', () => {
    expect(normalizarCedula('  1-1234-0567  ')).toBe('1-1234-0567');
    expect(normalizarCedula(' 1 1234 0567 ')).toBe('1-1234-0567');
    expect(normalizarCedula(' 1 - 1234 - 0567 ')).toBe('1-1234-0567');
    expect(normalizarCedula('   112340567   ')).toBe('1-1234-0567');
  });

  it('debe manejar DIMEX u otros formatos limpiando espacios', () => {
    expect(normalizarCedula(' 155812345678 ')).toBe('155812345678');
    expect(normalizarCedula('1558 1234 5678')).toBe('155812345678');
    expect(normalizarCedula('ABC-123')).toBe('ABC-123');
  });

  it('debe devolver valores no string o vacíos sin alterarlos', () => {
    expect(normalizarCedula('' as any)).toBe('');
    expect(normalizarCedula(null as any)).toBeNull();
    expect(normalizarCedula(undefined as any)).toBeUndefined();
  });
});
