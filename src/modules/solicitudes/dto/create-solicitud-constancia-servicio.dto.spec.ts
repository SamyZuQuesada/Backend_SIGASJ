import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CalidadTitularCambioTitular } from '../../../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import { MotivoConstanciaServicio } from '../../../common/enums/motivo-constancia-servicio.enum';
import { NaturalezaInmuebleCambioTitular } from '../../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { CreateSolicitudConstanciaServicioDto } from './create-solicitud-constancia-servicio.dto';

describe('CreateSolicitudConstanciaServicioDto', () => {
  const base = {
    tipoServicio: 'Domiciliar',
    nis: 'NIS-45892',
    propietarioInmueble: 'María Elena Rodríguez Vargas',
    nombreSolicitante: 'Carlos Alberto Mora Jiménez',
    identificacionSolicitante: '1-1234-0567',
    correoElectronico: 'carlos.mora@ejemplo.com',
    telefono: '8888-1234',
    folioReal: '123456-000',
    planoCatastrado: 'SJ-1234567-2020',
    planoAgrimensura: 'AG-998877-2019',
    naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'San Isidro de El General',
    direccionExacta: '100 m norte de la iglesia',
    motivo: MotivoConstanciaServicio.BONO_VIVIENDA,
    tramitePorRealizar: 'Solicitud bono BANHVI',
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    medioNotificacionSecundario: MedioNotificacionCambioTitular.TELEFONO,
    firma: 'data:image/png;base64,iVBORw0KGgo...',
  };

  const validar = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(CreateSolicitudConstanciaServicioDto, data);
    return validate(dto);
  };

  it('1. Acepta un payload válido completo con motivo estándar', async () => {
    const errors = await validar(base);
    expect(errors).toHaveLength(0);
  });

  it('2. Acepta motivo "Otro" cuando se incluye descripción en otroMotivo', async () => {
    const conOtro = {
      ...base,
      motivo: MotivoConstanciaServicio.OTRO,
      otroMotivo: 'Trámite especial ante IMAS',
    };
    const errors = await validar(conOtro);
    expect(errors).toHaveLength(0);
  });

  it('3. Rechaza motivo "Otro" si falta otroMotivo', async () => {
    const sinOtroMotivo = {
      ...base,
      motivo: MotivoConstanciaServicio.OTRO,
    };
    const errors = await validar(sinOtroMotivo);
    expect(errors.some((e) => e.property === 'otroMotivo')).toBe(true);
  });

  it('4. Rechaza motivo "Otro" si otroMotivo está vacío o solo espacios', async () => {
    const otroVacio = {
      ...base,
      motivo: MotivoConstanciaServicio.OTRO,
      otroMotivo: '   ',
    };
    const errors = await validar(otroVacio);
    expect(errors.some((e) => e.property === 'otroMotivo')).toBe(true);
  });

  it('5. Acepta omitir campos opcionales (planos, folio, trámite, medio secundario, firma)', async () => {
    const sinOpcionales = {
      tipoServicio: 'Domiciliar',
      nis: 'NIS-45892',
      propietarioInmueble: 'María Elena Rodríguez Vargas',
      nombreSolicitante: 'Carlos Alberto Mora Jiménez',
      identificacionSolicitante: '1-1234-0567',
      correoElectronico: 'carlos.mora@ejemplo.com',
      telefono: '8888-1234',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro de El General',
      direccionExacta: '100 m norte de la iglesia',
      motivo: MotivoConstanciaServicio.BONO_VIVIENDA,
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    };
    const errors = await validar(sinOpcionales);
    expect(errors).toHaveLength(0);
  });

  it('6. Rechaza motivo inválido o no reconocido', async () => {
    const errors = await validar({
      ...base,
      motivo: 'Motivo inventado',
    });
    expect(errors.some((e) => e.property === 'motivo')).toBe(true);
  });

  it('7. Rechaza correo electrónico con formato inválido', async () => {
    const errors = await validar({
      ...base,
      correoElectronico: 'correo-no-valido',
    });
    expect(errors.some((e) => e.property === 'correoElectronico')).toBe(true);
  });

  it('8. Rechaza campos obligatorios faltantes o vacíos', async () => {
    const errors = await validar({});
    const propiedadesConError = errors.map((e) => e.property);

    expect(propiedadesConError).toContain('tipoServicio');
    expect(propiedadesConError).toContain('nis');
    expect(propiedadesConError).toContain('propietarioInmueble');
    expect(propiedadesConError).toContain('nombreSolicitante');
    expect(propiedadesConError).toContain('identificacionSolicitante');
    expect(propiedadesConError).toContain('correoElectronico');
    expect(propiedadesConError).toContain('telefono');
    expect(propiedadesConError).toContain('naturalezaInmueble');
    expect(propiedadesConError).toContain('calidadTitular');
    expect(propiedadesConError).toContain('provincia');
    expect(propiedadesConError).toContain('canton');
    expect(propiedadesConError).toContain('distrito');
    expect(propiedadesConError).toContain('direccionExacta');
    expect(propiedadesConError).toContain('motivo');
    expect(propiedadesConError).toContain('medioNotificacionPrincipal');
  });

  it('9. Rechaza medio de notificación inválido', async () => {
    const errors = await validar({
      ...base,
      medioNotificacionPrincipal: 'WhatsApp',
    });
    expect(
      errors.some((e) => e.property === 'medioNotificacionPrincipal'),
    ).toBe(true);
  });
});
