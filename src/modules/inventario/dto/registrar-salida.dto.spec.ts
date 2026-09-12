import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegistrarSalidaDto } from './registrar-salida.dto';

async function validateSalida(payload: Record<string, unknown>) {
  const dto = plainToInstance(RegistrarSalidaDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('RegistrarSalidaDto — validaciones de salida', () => {
  it('acepta una salida con todos los campos válidos y aplica sanitización', async () => {
    const { dto, errors } = await validateSalida({
      idMaterial: 1,
      cantidad: 5,
      idAveria: 12,
      idSolicitud: 4,
      observacion: '  Reparación de fuga en tubería de 1/2"  ',
      fechaMovimiento: '2026-08-22T10:30:00Z',
    });

    expect(errors).toHaveLength(0);
    expect(dto.idMaterial).toBe(1);
    expect(dto.cantidad).toBe(5);
    expect(dto.idAveria).toBe(12);
    expect(dto.idSolicitud).toBe(4);
    expect(dto.observacion).toBe('Reparación de fuga en tubería de 1/2"');
    expect(dto.fechaMovimiento).toBeInstanceOf(Date);
  });

  it('acepta una salida mínima con solo material y cantidad', async () => {
    const { dto, errors } = await validateSalida({
      idMaterial: 2,
      cantidad: 3,
    });

    expect(errors).toHaveLength(0);
    expect(dto.idMaterial).toBe(2);
    expect(dto.cantidad).toBe(3);
    expect(dto.idAveria).toBeUndefined();
    expect(dto.idSolicitud).toBeUndefined();
    expect(dto.observacion).toBeUndefined();
    expect(dto.fechaMovimiento).toBeUndefined();
  });

  it('acepta alias materialId, averiaId y solicitudId como números o strings numéricos', async () => {
    const { dto, errors } = await validateSalida({
      materialId: '5',
      cantidad: '8',
      averiaId: '15',
      solicitudId: '7',
    });

    expect(errors).toHaveLength(0);
    expect(dto.materialId).toBe(5);
    expect(dto.cantidad).toBe(8);
    expect(dto.averiaId).toBe(15);
    expect(dto.solicitudId).toBe(7);
  });

  it('rechaza si falta la cantidad o no es un entero', async () => {
    const { errors: errorsFalta } = await validateSalida({
      idMaterial: 1,
    });
    expect(errorsFalta.some((e) => e.property === 'cantidad')).toBe(true);

    const { errors: errorsDecimal } = await validateSalida({
      idMaterial: 1,
      cantidad: 2.5,
    });
    expect(errorsDecimal.some((e) => e.property === 'cantidad')).toBe(true);
  });

  it('rechaza si la cantidad es cero o negativa', async () => {
    const { errors: errorsCero } = await validateSalida({
      idMaterial: 1,
      cantidad: 0,
    });
    expect(errorsCero.some((e) => e.property === 'cantidad')).toBe(true);

    const { errors: errorsNegativo } = await validateSalida({
      idMaterial: 1,
      cantidad: -3,
    });
    expect(errorsNegativo.some((e) => e.property === 'cantidad')).toBe(true);
  });

  it('rechaza si idMaterial es menor a 1 o no es entero', async () => {
    const { errors: errorsCero } = await validateSalida({
      idMaterial: 0,
      cantidad: 5,
    });
    expect(errorsCero.some((e) => e.property === 'idMaterial')).toBe(true);

    const { errors: errorsNegativo } = await validateSalida({
      idMaterial: -1,
      cantidad: 5,
    });
    expect(errorsNegativo.some((e) => e.property === 'idMaterial')).toBe(true);
  });

  it('rechaza si idAveria o averiaId es menor a 1', async () => {
    const { errors: errorsAveria } = await validateSalida({
      idMaterial: 1,
      cantidad: 5,
      idAveria: 0,
    });
    expect(errorsAveria.some((e) => e.property === 'idAveria')).toBe(true);
  });

  it('rechaza si idSolicitud o solicitudId es menor a 1', async () => {
    const { errors: errorsSolicitud } = await validateSalida({
      idMaterial: 1,
      cantidad: 5,
      idSolicitud: 0,
    });
    expect(errorsSolicitud.some((e) => e.property === 'idSolicitud')).toBe(
      true,
    );
  });

  it('rechaza si la observación supera los 1000 caracteres', async () => {
    const { errors } = await validateSalida({
      idMaterial: 1,
      cantidad: 5,
      observacion: 'a'.repeat(1001),
    });
    expect(errors.some((e) => e.property === 'observacion')).toBe(true);
  });
});
