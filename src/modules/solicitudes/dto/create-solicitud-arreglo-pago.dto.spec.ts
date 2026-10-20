import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PlazoArregloPago } from '../../../common/enums/plazo-arreglo-pago.enum';
import { CreateSolicitudArregloPagoDto } from './create-solicitud-arreglo-pago.dto';

describe('CreateSolicitudArregloPagoDto', () => {
  const getDtoValido = (): Record<string, any> => ({
    nombre: 'Juan Carlos Rodríguez Mora',
    cedula: '1-1234-0567',
    vecinoDe: 'San Juan de Desamparados, 200m norte de la plaza',
    telefono: '8888-1234',
    numeroCuentaServicio: 'CTA-00984',
    montoPrimaInicial: 30000,
    plazoSeleccionado: PlazoArregloPago.MESES_6,
    firma: 'data:image/png;base64,iVBORw0KGgo...',
  });

  const validar = async (data: Record<string, any>) => {
    const dto = plainToInstance(CreateSolicitudArregloPagoDto, data);
    return validate(dto);
  };

  it('1. Debe validar exitosamente un DTO con todos los campos correctos', async () => {
    const errors = await validar(getDtoValido());
    expect(errors.length).toBe(0);
  });

  it('2. Debe validar nombre obligatorio y longitud máxima', async () => {
    const sinNombre = await validar({ ...getDtoValido(), nombre: '' });
    expect(sinNombre.some((e) => e.property === 'nombre')).toBe(true);

    const nombreMuyLargo = await validar({
      ...getDtoValido(),
      nombre: 'A'.repeat(151),
    });
    expect(nombreMuyLargo.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('3. Debe validar cédula obligatoria', async () => {
    const sinCedula = await validar({ ...getDtoValido(), cedula: '' });
    expect(sinCedula.some((e) => e.property === 'cedula')).toBe(true);
  });

  it('4. Debe validar vecinoDe obligatorio', async () => {
    const sinVecino = await validar({ ...getDtoValido(), vecinoDe: '' });
    expect(sinVecino.some((e) => e.property === 'vecinoDe')).toBe(true);
  });

  it('5. Debe validar teléfono obligatorio', async () => {
    const sinTel = await validar({ ...getDtoValido(), telefono: '' });
    expect(sinTel.some((e) => e.property === 'telefono')).toBe(true);
  });

  it('6. Debe validar número de cuenta del servicio obligatorio', async () => {
    const sinCuenta = await validar({
      ...getDtoValido(),
      numeroCuentaServicio: '',
    });
    expect(sinCuenta.some((e) => e.property === 'numeroCuentaServicio')).toBe(
      true,
    );
  });

  it('7. Debe validar montoPrimaInicial como número positivo o cero', async () => {
    const conCero = await validar({ ...getDtoValido(), montoPrimaInicial: 0 });
    expect(conCero.length).toBe(0);

    const negativo = await validar({
      ...getDtoValido(),
      montoPrimaInicial: -500,
    });
    expect(negativo.some((e) => e.property === 'montoPrimaInicial')).toBe(true);
  });

  it('8. Debe rechazar plazos no permitidos o faltantes', async () => {
    const sinPlazo = await validar({
      ...getDtoValido(),
      plazoSeleccionado: undefined,
    });
    expect(sinPlazo.some((e) => e.property === 'plazoSeleccionado')).toBe(true);

    const plazoInvalido = await validar({
      ...getDtoValido(),
      plazoSeleccionado: '48 meses',
    });
    expect(plazoInvalido.some((e) => e.property === 'plazoSeleccionado')).toBe(
      true,
    );
    const err = plazoInvalido.find((e) => e.property === 'plazoSeleccionado');
    expect(Object.values(err!.constraints || {})[0]).toContain(
      'Opciones permitidas',
    );
  });

  it('9. No debe seleccionar un plazo por defecto si no se proporciona', () => {
    const dto = new CreateSolicitudArregloPagoDto();
    expect(dto.plazoSeleccionado).toBeUndefined();
  });

  it('10. Debe admitir firma opcional', async () => {
    const sinFirma = await validar({ ...getDtoValido(), firma: undefined });
    expect(sinFirma.length).toBe(0);
  });
});
