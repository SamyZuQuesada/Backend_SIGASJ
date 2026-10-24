import {
  isMotivoConstanciaServicioValido,
  isMotivoOtro,
  MotivoConstanciaServicio,
  MOTIVOS_CONSTANCIA_SERVICIO,
} from './motivo-constancia-servicio.enum';

describe('MotivoConstanciaServicio Enum', () => {
  it('1. Debe contener todos los motivos estándar y la opción Otro', () => {
    expect(MOTIVOS_CONSTANCIA_SERVICIO).toContain(
      MotivoConstanciaServicio.BONO_VIVIENDA,
    );
    expect(MOTIVOS_CONSTANCIA_SERVICIO).toContain(
      MotivoConstanciaServicio.TRAMITE_BANCARIO,
    );
    expect(MOTIVOS_CONSTANCIA_SERVICIO).toContain(
      MotivoConstanciaServicio.VISADO_MUNICIPAL,
    );
    expect(MOTIVOS_CONSTANCIA_SERVICIO).toContain(
      MotivoConstanciaServicio.CONEXION_ELECTRICA,
    );
    expect(MOTIVOS_CONSTANCIA_SERVICIO).toContain(
      MotivoConstanciaServicio.TRAMITE_NOTARIAL,
    );
    expect(MOTIVOS_CONSTANCIA_SERVICIO).toContain(
      MotivoConstanciaServicio.EXONERACION_BIENES_INMUEBLES,
    );
    expect(MOTIVOS_CONSTANCIA_SERVICIO).toContain(
      MotivoConstanciaServicio.OTRO,
    );
  });

  it('2. isMotivoConstanciaServicioValido valida opciones en cualquier capitalización', () => {
    expect(isMotivoConstanciaServicioValido('Bono de vivienda')).toBe(true);
    expect(isMotivoConstanciaServicioValido('bono de vivienda')).toBe(true);
    expect(isMotivoConstanciaServicioValido('OTRO')).toBe(true);
    expect(isMotivoConstanciaServicioValido('Trámite Bancario')).toBe(true);
    expect(isMotivoConstanciaServicioValido('Invalido')).toBe(false);
    expect(isMotivoConstanciaServicioValido('')).toBe(false);
  });

  it('3. isMotivoOtro detecta específicamente la opción Otro', () => {
    expect(isMotivoOtro('Otro')).toBe(true);
    expect(isMotivoOtro('otro')).toBe(true);
    expect(isMotivoOtro('OTRO')).toBe(true);
    expect(isMotivoOtro('Bono de vivienda')).toBe(false);
    expect(isMotivoOtro('')).toBe(false);
  });
});
