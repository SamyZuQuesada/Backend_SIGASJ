import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMaterialDto } from './update-material.dto';

async function validateUpdate(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateMaterialDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('UpdateMaterialDto — validaciones de entrada', () => {
  it('permite una carga vacía porque todos los campos son opcionales para PATCH', async () => {
    const { errors } = await validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('acepta la actualización parcial de campos válidos con trim', async () => {
    const { dto, errors } = await validateUpdate({
      nombre: '  Tubo PVC 3/4 pulgada  ',
      descripcion: '  Nueva descripción para agua fría  ',
      unidadMedida: '  Tira  ',
      ubicacion: '  Bodega 2 - Estante A  ',
      stockMinimo: 20,
      activo: false,
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Tubo PVC 3/4 pulgada');
    expect(dto.descripcion).toBe('Nueva descripción para agua fría');
    expect(dto.unidadMedida).toBe('Tira');
    expect(dto.ubicacion).toBe('Bodega 2 - Estante A');
    expect(dto.stockMinimo).toBe(20);
    expect(dto.activo).toBe(false);
  });

  it('rechaza si el nombre es una cadena vacía o solo espacios', async () => {
    const { errors } = await validateUpdate({
      nombre: '   ',
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el nombre excede 150 caracteres', async () => {
    const { errors } = await validateUpdate({
      nombre: 'A'.repeat(151),
    });
    const error = errors.find((e) => e.property === 'nombre');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si la unidad de medida es una cadena vacía o solo espacios', async () => {
    const { errors } = await validateUpdate({
      unidadMedida: '   ',
    });
    expect(errors.some((e) => e.property === 'unidadMedida')).toBe(true);
  });

  it('rechaza si la unidad de medida excede 50 caracteres', async () => {
    const { errors } = await validateUpdate({
      unidadMedida: 'A'.repeat(51),
    });
    const error = errors.find((e) => e.property === 'unidadMedida');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si la descripción excede 1000 caracteres', async () => {
    const { errors } = await validateUpdate({
      descripcion: 'X'.repeat(1001),
    });
    const error = errors.find((e) => e.property === 'descripcion');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si la ubicación excede 150 caracteres', async () => {
    const { errors } = await validateUpdate({
      ubicacion: 'Y'.repeat(151),
    });
    const error = errors.find((e) => e.property === 'ubicacion');
    expect(error).toBeDefined();
    expect(error?.constraints?.maxLength).toBeDefined();
  });

  it('rechaza si el stock mínimo es un número negativo', async () => {
    const { errors } = await validateUpdate({
      stockMinimo: -1,
    });
    const error = errors.find((e) => e.property === 'stockMinimo');
    expect(error).toBeDefined();
    expect(error?.constraints?.min).toBeDefined();
  });

  it('rechaza si el stock mínimo no es entero', async () => {
    const { errors } = await validateUpdate({
      stockMinimo: 4.5,
    });
    const error = errors.find((e) => e.property === 'stockMinimo');
    expect(error).toBeDefined();
    expect(error?.constraints?.isInt).toBeDefined();
  });

  it('rechaza si activo no es booleano', async () => {
    const dto = plainToInstance(
      UpdateMaterialDto,
      { activo: 'no_booleano' },
      { enableImplicitConversion: false },
    );
    const errors = await validate(dto);
    const error = errors.find((e) => e.property === 'activo');
    expect(error).toBeDefined();
    expect(error?.constraints?.isBoolean).toBeDefined();
  });

  it('acepta idCategoria numérico, null para desvincular y alias categoriaId', async () => {
    const res1 = await validateUpdate({ idCategoria: 4 });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.idCategoria).toBe(4);

    const res2 = await validateUpdate({ idCategoria: null });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.idCategoria).toBeNull();

    const res3 = await validateUpdate({ categoriaId: '5' });
    expect(res3.errors).toHaveLength(0);
    expect(res3.dto.categoriaId ?? res3.dto.idCategoria).toBe(5);
  });

  it('rechaza idCategoria si es menor a 1 o no es entero', async () => {
    const res1 = await validateUpdate({ idCategoria: 0 });
    expect(res1.errors.some((e) => e.property === 'idCategoria')).toBe(true);

    const res2 = await validateUpdate({ idCategoria: 2.5 });
    expect(res2.errors.some((e) => e.property === 'idCategoria')).toBe(true);
  });

  it('acepta idProveedor numérico, null para desvincular y alias proveedorId', async () => {
    const res1 = await validateUpdate({ idProveedor: 7 });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.idProveedor).toBe(7);

    const res2 = await validateUpdate({ idProveedor: null });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.idProveedor).toBeNull();

    const res3 = await validateUpdate({ proveedorId: '8' });
    expect(res3.errors).toHaveLength(0);
    expect(res3.dto.proveedorId ?? res3.dto.idProveedor).toBe(8);
  });

  it('rechaza idProveedor si es menor a 1 o no es entero', async () => {
    const res1 = await validateUpdate({ idProveedor: 0 });
    expect(res1.errors.some((e) => e.property === 'idProveedor')).toBe(true);

    const res2 = await validateUpdate({ idProveedor: 3.14 });
    expect(res2.errors.some((e) => e.property === 'idProveedor')).toBe(true);
  });

  it('no expone campos de existencias físicas stockActual ni IDs', () => {
    const dto = new UpdateMaterialDto();
    expect(dto).not.toHaveProperty('stockActual');
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
  });
});
