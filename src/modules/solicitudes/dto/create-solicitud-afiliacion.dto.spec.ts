import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSolicitudAfiliacionDto } from './create-solicitud-afiliacion.dto';

describe('CreateSolicitudAfiliacionDto', () => {
  const baseValido = {
    fechaSolicitud: '2026-10-23',
    nombre: 'María Elena Rodríguez Vargas',
    identificacion: '1-1234-0567',
    vecinoDe: 'San Juan, 200 m norte de la plaza',
    estadoCivil: 'Casado(a)',
    telefono: '8888-1234',
    correoElectronico: 'maria.rodriguez@ejemplo.com',
    numeroAbonado: '45892',
    numeroPlano: 'SJ-1234567-2020',
    folioReal: '123456-000',
    firmaSolicitante: 'data:image/png;base64,AAA',
    recomendacion1Nombre: 'Carlos Alberto Mora Chaves',
    recomendacion1Identificacion: '1-0987-6543',
    recomendacion1NumeroAbonado: '12045',
    recomendacion1Firma: 'data:image/png;base64,rec1',
    recomendacion2Nombre: 'Ana Lucía Vargas Quirós',
    recomendacion2Identificacion: '1-2345-6789',
    recomendacion2NumeroAbonado: '13088',
    recomendacion2Firma: 'data:image/png;base64,rec2',
  };

  const validar = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(CreateSolicitudAfiliacionDto, data);
    return validate(dto);
  };

  it('acepta payload válido completo', async () => {
    expect(await validar(baseValido)).toHaveLength(0);
  });

  it('acepta omitir folio y firmas', async () => {
    const sinOpcionales = { ...baseValido };
    delete (sinOpcionales as { folioReal?: string }).folioReal;
    delete (sinOpcionales as { firmaSolicitante?: string }).firmaSolicitante;
    delete (sinOpcionales as { recomendacion1Firma?: string })
      .recomendacion1Firma;
    delete (sinOpcionales as { recomendacion2Firma?: string })
      .recomendacion2Firma;
    expect(await validar(sinOpcionales)).toHaveLength(0);
  });

  it('aplica trim al nombre e identificación', () => {
    const dto = plainToInstance(CreateSolicitudAfiliacionDto, {
      ...baseValido,
      nombre: '  María Elena  ',
      identificacion: '  01-0234-0567  ',
    });
    expect(dto.nombre).toBe('María Elena');
    expect(dto.identificacion).toBe('01-0234-0567');
  });

  it('rechaza nombre vacío', async () => {
    const errors = await validar({ ...baseValido, nombre: '   ' });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza identificación vacía', async () => {
    const errors = await validar({ ...baseValido, identificacion: '' });
    expect(errors.some((e) => e.property === 'identificacion')).toBe(true);
  });

  it('rechaza vecinoDe vacío', async () => {
    const errors = await validar({ ...baseValido, vecinoDe: '' });
    expect(errors.some((e) => e.property === 'vecinoDe')).toBe(true);
  });

  it('rechaza estadoCivil vacío', async () => {
    const errors = await validar({ ...baseValido, estadoCivil: '' });
    expect(errors.some((e) => e.property === 'estadoCivil')).toBe(true);
  });

  it('rechaza teléfono vacío', async () => {
    const errors = await validar({ ...baseValido, telefono: '' });
    expect(errors.some((e) => e.property === 'telefono')).toBe(true);
  });

  it('rechaza correo inválido', async () => {
    const errors = await validar({
      ...baseValido,
      correoElectronico: 'no-es-correo',
    });
    expect(errors.some((e) => e.property === 'correoElectronico')).toBe(true);
  });

  it('rechaza numeroAbonado vacío', async () => {
    const errors = await validar({ ...baseValido, numeroAbonado: '' });
    expect(errors.some((e) => e.property === 'numeroAbonado')).toBe(true);
  });

  it('rechaza numeroPlano vacío', async () => {
    const errors = await validar({ ...baseValido, numeroPlano: '' });
    expect(errors.some((e) => e.property === 'numeroPlano')).toBe(true);
  });

  it('rechaza fecha inválida', async () => {
    const errors = await validar({
      ...baseValido,
      fechaSolicitud: '23/10/2026',
    });
    expect(errors.some((e) => e.property === 'fechaSolicitud')).toBe(true);
  });

  it('rechaza falta recomendación 1 (nombre)', async () => {
    const sinRec1 = { ...baseValido, recomendacion1Nombre: '' };
    const errors = await validar(sinRec1);
    expect(errors.some((e) => e.property === 'recomendacion1Nombre')).toBe(
      true,
    );
  });

  it('rechaza falta recomendación 2 (identificación)', async () => {
    const sinRec2 = { ...baseValido, recomendacion2Identificacion: '' };
    const errors = await validar(sinRec2);
    expect(
      errors.some((e) => e.property === 'recomendacion2Identificacion'),
    ).toBe(true);
  });

  it('rechaza recomendación 1 incompleta (abonado)', async () => {
    const errors = await validar({
      ...baseValido,
      recomendacion1NumeroAbonado: '',
    });
    expect(
      errors.some((e) => e.property === 'recomendacion1NumeroAbonado'),
    ).toBe(true);
  });

  it('rechaza recomendación 2 incompleta (nombre)', async () => {
    const errors = await validar({
      ...baseValido,
      recomendacion2Nombre: '   ',
    });
    expect(errors.some((e) => e.property === 'recomendacion2Nombre')).toBe(
      true,
    );
  });

  it('conserva identificación y abonado con ceros como texto', () => {
    const dto = plainToInstance(CreateSolicitudAfiliacionDto, {
      ...baseValido,
      identificacion: '01-0234-0567',
      numeroAbonado: '0045892',
    });
    expect(dto.identificacion).toBe('01-0234-0567');
    expect(dto.numeroAbonado).toBe('0045892');
  });
});
