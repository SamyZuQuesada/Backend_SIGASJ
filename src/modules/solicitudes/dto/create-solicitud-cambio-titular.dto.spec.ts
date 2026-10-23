import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CalidadTitularCambioTitular } from '../../../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { CreateSolicitudCambioTitularDto } from './create-solicitud-cambio-titular.dto';

describe('CreateSolicitudCambioTitularDto', () => {
  const base = {
    nombreSolicitante: 'Ana Lucía Vargas Quirós',
    identificacionSolicitante: '1-1234-0567',
    telefono: '8888-1234',
    nombrePropietarioRegistral: 'Carlos Alberto Mora Jiménez',
    identificacionPropietario: '1-0987-6543',
    folioReal: '123456-000',
    planoCatastrado: 'SJ-1234567-2020',
    naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    nis: 'NIS-45892',
    facturaANombreDe: 'Carlos Alberto Mora Jiménez',
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
  };

  const validar = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(CreateSolicitudCambioTitularDto, data);
    return validate(dto);
  };

  it('acepta un payload válido completo', async () => {
    const errors = await validar(base);
    expect(errors).toHaveLength(0);
  });

  it('acepta omitir planos, folio, medio secundario y firma', async () => {
    const sinOpcionales = { ...base };
    delete (sinOpcionales as { folioReal?: string }).folioReal;
    delete (sinOpcionales as { planoCatastrado?: string }).planoCatastrado;
    const errors = await validar(sinOpcionales);
    expect(errors).toHaveLength(0);
  });

  it('rechaza naturalezaInmueble inexistente', async () => {
    const errors = await validar({
      ...base,
      naturalezaInmueble: 'Terreno lunar',
    });
    expect(errors.some((e) => e.property === 'naturalezaInmueble')).toBe(true);
  });

  it('rechaza calidadTitular inexistente', async () => {
    const errors = await validar({
      ...base,
      calidadTitular: 'Dueño absoluto inventado',
    });
    expect(errors.some((e) => e.property === 'calidadTitular')).toBe(true);
  });

  it('rechaza medio de notificación inválido', async () => {
    const errors = await validar({
      ...base,
      medioNotificacionPrincipal: 'Telegram',
    });
    expect(
      errors.some((e) => e.property === 'medioNotificacionPrincipal'),
    ).toBe(true);
  });

  it('rechaza identificación vacía', async () => {
    const errors = await validar({
      ...base,
      identificacionSolicitante: '   ',
    });
    expect(errors.some((e) => e.property === 'identificacionSolicitante')).toBe(
      true,
    );
  });
});
