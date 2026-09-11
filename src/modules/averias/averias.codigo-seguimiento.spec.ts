import { QueryFailedError } from 'typeorm';
import {
  buildCodigoSeguimiento,
  isCodigoSeguimientoUniqueViolation,
  parseConsecutiveFromCodigo,
} from './averias.codigo-seguimiento';

describe('Generación de codigoSeguimiento', () => {
  it('formatea AV-YYYY-NNNN con el año indicado', () => {
    expect(buildCodigoSeguimiento(2025, 1)).toBe('AV-2025-0001');
    expect(buildCodigoSeguimiento(2026, 12)).toBe('AV-2026-0012');
  });

  it('parsea el consecutivo del código del año correspondiente', () => {
    expect(parseConsecutiveFromCodigo('AV-2026-0007', 2026)).toBe(7);
    expect(parseConsecutiveFromCodigo('AV-2026-0007', 2025)).toBeNull();
    expect(parseConsecutiveFromCodigo('OTRO-2026-0001', 2026)).toBeNull();
  });

  it('solo trata como colisión UNIQUE de código los errores 2627/2601/SQLITE UNIQUE', () => {
    const uniqueSqlServer = new QueryFailedError('INSERT INTO Averia', [], {
      number: 2627,
      message: 'Violation of UNIQUE KEY constraint',
    });
    expect(isCodigoSeguimientoUniqueViolation(uniqueSqlServer)).toBe(true);

    const timeout = new QueryFailedError('INSERT INTO Averia', [], {
      message: 'Timeout ETIMEDOUT Failed to connect',
    });
    expect(isCodigoSeguimientoUniqueViolation(timeout)).toBe(false);

    const fk = new QueryFailedError('INSERT INTO Averia', [], {
      number: 547,
      message: 'FOREIGN KEY constraint conflict',
    });
    expect(isCodigoSeguimientoUniqueViolation(fk)).toBe(false);

    expect(isCodigoSeguimientoUniqueViolation(new Error('UNIQUE'))).toBe(false);
  });
});
