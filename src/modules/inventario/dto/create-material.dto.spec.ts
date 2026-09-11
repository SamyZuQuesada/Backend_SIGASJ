import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMaterialDto } from './create-material.dto';

async function validateCreate(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateMaterialDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateMaterialDto — validaciones de entrada', () => {
  it('acepta un material con todos los campos válidos y aplica trim', async () => {
    const { dto, errors } = await validateCreate({
      nombre: '  Tubo PVC 1/2 pulgada  ',
      descripcion: '  Tubo para agua potable  ',
      unidadMedida: '  Tubo  ',
      ubicacion: '  Bodega 1  ',
      stockMinimo: 10,
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Tubo PVC 1/2 pulgada');
    expect(dto.descripcion).toBe('Tubo para agua potable');
    expect(dto.unidadMedida).toBe('Tubo');
    expect(dto.ubicacion).toBe('Bodega 1');
    expect(dto.stockMinimo).toBe(10);
  });

  it('acepta un material con solo los campos requeridos', async () => {
    const { dto, errors } = await validateCreate({
      nombre: 'Válvula de bola 1/2"',
      unidadMedida: 'Unidad',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Válvula de bola 1/2"');
    expect(dto.unidadMedida).toBe('Unidad');
    expect(dto.descripcion).toBeUndefined();
    expect(dto.ubicacion).toBeUndefined();
  });

  it('rechaza si falta el nombre o es una cadena vacía', async () => {
    const { errors: errorsFalta } = await validateCreate({
      unidadMedida: 'Unidad',
    });
    expect(errorsFalta.some((e) => e.property === 'nombre')).toBe(true);

    const { errors: errorsVacio } = await validateCreate({
      nombre: '   ',
      unidadMedida: 'Unidad',
    });
    expect(errorsVacio.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el nombre excede 150 caracteres', async () => {
    const { errors } = await validateCreate({
      nombre: 'A'.repeat(151),
      unidadMedida: 'Unidad',
    });
    const error = errors.find((e) => e.property === 'nombre');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si falta la unidad de medida o es una cadena vacía', async () => {
    const { errors: errorsFalta } = await validateCreate({
      nombre: 'Codo 90 PVC',
    });
    expect(errorsFalta.some((e) => e.property === 'unidadMedida')).toBe(true);

    const { errors: errorsVacio } = await validateCreate({
      nombre: 'Codo 90 PVC',
      unidadMedida: '   ',
    });
    expect(errorsVacio.some((e) => e.property === 'unidadMedida')).toBe(true);
  });

  it('rechaza si la unidad de medida excede 50 caracteres', async () => {
    const { errors } = await validateCreate({
      nombre: 'Codo 90 PVC',
      unidadMedida: 'A'.repeat(51),
    });
    const error = errors.find((e) => e.property === 'unidadMedida');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si la descripción excede 1000 caracteres', async () => {
    const { errors } = await validateCreate({
      nombre: 'Pegamento PVC',
      unidadMedida: 'Tarro',
      descripcion: 'X'.repeat(1001),
    });
    const error = errors.find((e) => e.property === 'descripcion');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si la ubicación excede 150 caracteres', async () => {
    const { errors } = await validateCreate({
      nombre: 'Pegamento PVC',
      unidadMedida: 'Tarro',
      ubicacion: 'Y'.repeat(151),
    });
    const error = errors.find((e) => e.property === 'ubicacion');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si el stock mínimo es negativo', async () => {
    const { errors } = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      stockMinimo: -5,
    });
    const error = errors.find((e) => e.property === 'stockMinimo');
    expect(error).toBeDefined();
    expect(error?.constraints?.min).toBeDefined();
  });

  it('rechaza si el stock mínimo no es un entero', async () => {
    const { errors } = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      stockMinimo: 3.14,
    });
    const error = errors.find((e) => e.property === 'stockMinimo');
    expect(error).toBeDefined();
    expect(error?.constraints?.isInt).toBeDefined();
  });

  it('acepta idCategoria numérico válido y alias categoriaId', async () => {
    const res1 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      idCategoria: 2,
    });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.idCategoria).toBe(2);

    const res2 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      categoriaId: '3',
    });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.categoriaId ?? res2.dto.idCategoria).toBe(3);
  });

  it('rechaza idCategoria si no es entero o es menor a 1', async () => {
    const res1 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      idCategoria: 0,
    });
    expect(res1.errors.some((e) => e.property === 'idCategoria')).toBe(true);

    const res2 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      idCategoria: -1,
    });
    expect(res2.errors.some((e) => e.property === 'idCategoria')).toBe(true);
  });

  it('acepta idProveedor numérico válido y alias proveedorId', async () => {
    const res1 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      idProveedor: 4,
    });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.idProveedor).toBe(4);

    const res2 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      proveedorId: '5',
    });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.proveedorId ?? res2.dto.idProveedor).toBe(5);
  });

  it('rechaza idProveedor si no es entero o es menor a 1', async () => {
    const res1 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      idProveedor: 0,
    });
    expect(res1.errors.some((e) => e.property === 'idProveedor')).toBe(true);

    const res2 = await validateCreate({
      nombre: 'Tubo PVC 1/2',
      unidadMedida: 'Tubo',
      idProveedor: -2,
    });
    expect(res2.errors.some((e) => e.property === 'idProveedor')).toBe(true);
  });

  it('no declara campos de existencias físicas ni auditoría para el alta', () => {
    const dto = new CreateMaterialDto();
    expect(dto).not.toHaveProperty('stockActual');
    expect(dto).not.toHaveProperty('activo');
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
  });
});
