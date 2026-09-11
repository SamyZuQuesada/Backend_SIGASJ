import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegistrarEntradaDto } from './registrar-entrada.dto';

async function validateEntrada(payload: Record<string, unknown>) {
  const dto = plainToInstance(RegistrarEntradaDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('RegistrarEntradaDto — validaciones de entrada', () => {
  it('acepta una entrada con todos los campos válidos y aplica sanitización', async () => {
    const { dto, errors } = await validateEntrada({
      idMaterial: 1,
      cantidad: 15,
      idProveedor: 3,
      observacion: '  Factura de compra #1234  ',
      fechaMovimiento: '2026-08-22T10:30:00Z',
    });

    expect(errors).toHaveLength(0);
    expect(dto.idMaterial).toBe(1);
    expect(dto.cantidad).toBe(15);
    expect(dto.idProveedor).toBe(3);
    expect(dto.observacion).toBe('Factura de compra #1234');
    expect(dto.fechaMovimiento).toBeInstanceOf(Date);
  });

  it('acepta una entrada mínima con solo material y cantidad', async () => {
    const { dto, errors } = await validateEntrada({
      idMaterial: 2,
      cantidad: 10,
    });

    expect(errors).toHaveLength(0);
    expect(dto.idMaterial).toBe(2);
    expect(dto.cantidad).toBe(10);
    expect(dto.idProveedor).toBeUndefined();
    expect(dto.observacion).toBeUndefined();
    expect(dto.fechaMovimiento).toBeUndefined();
  });

  it('acepta alias materialId y proveedorId como números o strings numéricos', async () => {
    const { dto, errors } = await validateEntrada({
      materialId: '5',
      cantidad: '20',
      proveedorId: '8',
    });

    expect(errors).toHaveLength(0);
    expect(dto.materialId).toBe(5);
    expect(dto.cantidad).toBe(20);
    expect(dto.proveedorId).toBe(8);
  });

  it('rechaza si falta la cantidad o no es un entero', async () => {
    const { errors: errorsFalta } = await validateEntrada({
      idMaterial: 1,
    });
    expect(errorsFalta.some((e) => e.property === 'cantidad')).toBe(true);

    const { errors: errorsDecimal } = await validateEntrada({
      idMaterial: 1,
      cantidad: 3.5,
    });
    expect(errorsDecimal.some((e) => e.property === 'cantidad')).toBe(true);
  });

  it('rechaza si la cantidad es cero o negativa', async () => {
    const { errors: errorsCero } = await validateEntrada({
      idMaterial: 1,
      cantidad: 0,
    });
    expect(errorsCero.some((e) => e.property === 'cantidad')).toBe(true);

    const { errors: errorsNegativo } = await validateEntrada({
      idMaterial: 1,
      cantidad: -5,
    });
    expect(errorsNegativo.some((e) => e.property === 'cantidad')).toBe(true);
  });

  it('rechaza si idMaterial es menor a 1 o no es entero', async () => {
    const { errors: errorsCero } = await validateEntrada({
      idMaterial: 0,
      cantidad: 10,
    });
    expect(errorsCero.some((e) => e.property === 'idMaterial')).toBe(true);

    const { errors: errorsNegativo } = await validateEntrada({
      idMaterial: -1,
      cantidad: 10,
    });
    expect(errorsNegativo.some((e) => e.property === 'idMaterial')).toBe(true);
  });

  it('rechaza si idProveedor es menor a 1', async () => {
    const { errors } = await validateEntrada({
      idMaterial: 1,
      cantidad: 10,
      idProveedor: 0,
    });
    expect(errors.some((e) => e.property === 'idProveedor')).toBe(true);
  });

  it('rechaza si la observación supera los 1000 caracteres', async () => {
    const { errors } = await validateEntrada({
      idMaterial: 1,
      cantidad: 5,
      observacion: 'A'.repeat(1001),
    });
    expect(errors.some((e) => e.property === 'observacion')).toBe(true);
  });
});
