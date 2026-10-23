import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CalidadTitularCambioTitular } from '../../../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import { PropositoInfraestructuraLinderosConfirmado } from '../../../common/enums/proposito-infraestructura-linderos.enum';
import { TipoPersonaInfraestructuraLinderos } from '../../../common/enums/tipo-persona-infraestructura-linderos.enum';
import { CreateSolicitudInfraestructuraLinderosDto } from './create-solicitud-infraestructura-linderos.dto';

describe('CreateSolicitudInfraestructuraLinderosDto', () => {
  const documentosReunion = [
    { id: 1, tokenReclamo: 'token-identificacion-001' },
    { id: 2, tokenReclamo: 'token-plano-catastrado-002' },
    { id: 3, tokenReclamo: 'token-plano-agrimensura-003' },
  ];

  const baseFisica = {
    nis: 'NIS-77881',
    tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
    nombreFisica: 'María Elena',
    apellidosFisica: 'Rodríguez Vargas',
    identificacionFisica: '1-1234-0567',
    telefonoFisica: '8888-1234',
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'San Isidro de El General',
    direccionExacta: '100 m norte de la iglesia',
    planoCatastrado: 'SJ-1234567-2020',
    planoAgrimensura: 'AG-998877-2019',
    proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    valorNotificacionPrincipal: 'maria@ejemplo.com',
    documentos: documentosReunion,
  };

  const baseJuridica = {
    nis: 'NIS-99001',
    tipoPersona: TipoPersonaInfraestructuraLinderos.JURIDICA,
    razonSocial: 'Inversiones del Valle S.A.',
    cedulaJuridica: '3-101-123456',
    nombreRepresentante: 'Luis Alberto Mora Chaves',
    identificacionRepresentante: '1-0987-6543',
    telefonoRepresentante: '8777-4321',
    calidadTitular: CalidadTitularCambioTitular.REPRESENTANTE_LEGAL,
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'Daniel Flores',
    direccionExacta: 'Frente a la escuela',
    planoCatastrado: 'SJ-999',
    planoAgrimensura: 'AG-111',
    proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
    documentos: documentosReunion,
  };

  const validar = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(
      CreateSolicitudInfraestructuraLinderosDto,
      data,
    );
    return validate(dto);
  };

  it('acepta persona física válida', async () => {
    expect(await validar(baseFisica)).toHaveLength(0);
  });

  it('acepta persona jurídica válida', async () => {
    expect(await validar(baseJuridica)).toHaveLength(0);
  });

  it('acepta omitir folio, medio secundario y firma', async () => {
    const errors = await validar(baseFisica);
    expect(errors).toHaveLength(0);
  });

  it('rechaza NIS vacío', async () => {
    const errors = await validar({ ...baseFisica, nis: '   ' });
    expect(errors.some((e) => e.property === 'nis')).toBe(true);
  });

  it('rechaza tipoPersona inválido', async () => {
    const errors = await validar({ ...baseFisica, tipoPersona: 'Empresa' });
    expect(errors.some((e) => e.property === 'tipoPersona')).toBe(true);
  });

  it('persona física sin nombre → rechazo', async () => {
    const sinNombre = { ...baseFisica };
    delete (sinNombre as { nombreFisica?: string }).nombreFisica;
    const errors = await validar(sinNombre);
    expect(errors.some((e) => e.property === 'nombreFisica')).toBe(true);
  });

  it('persona física no exige campos jurídicos', async () => {
    const errors = await validar(baseFisica);
    expect(errors.some((e) => e.property === 'razonSocial')).toBe(false);
  });

  it('persona jurídica sin razón social → rechazo', async () => {
    const sinRazon = { ...baseJuridica };
    delete (sinRazon as { razonSocial?: string }).razonSocial;
    const errors = await validar(sinRazon);
    expect(errors.some((e) => e.property === 'razonSocial')).toBe(true);
  });

  it('persona jurídica no exige campos físicos', async () => {
    const errors = await validar(baseJuridica);
    expect(errors.some((e) => e.property === 'nombreFisica')).toBe(false);
  });

  it('rechaza calidadTitular inexistente', async () => {
    const errors = await validar({
      ...baseFisica,
      calidadTitular: 'Inquilino inventado',
    });
    expect(errors.some((e) => e.property === 'calidadTitular')).toBe(true);
  });

  it('rechaza propósito inexistente', async () => {
    const errors = await validar({
      ...baseFisica,
      proposito: 'Ampliación inventada',
    });
    expect(errors.some((e) => e.property === 'proposito')).toBe(true);
  });

  it('Reunión de fincas sin planoAgrimensura → rechazo', async () => {
    const sinPlano = { ...baseFisica };
    delete (sinPlano as { planoAgrimensura?: string }).planoAgrimensura;
    const errors = await validar(sinPlano);
    expect(errors.some((e) => e.property === 'planoAgrimensura')).toBe(true);
  });

  it('rechaza planoCatastrado vacío', async () => {
    const errors = await validar({ ...baseFisica, planoCatastrado: '' });
    expect(errors.some((e) => e.property === 'planoCatastrado')).toBe(true);
  });

  it('rechaza medio de notificación inválido', async () => {
    const errors = await validar({
      ...baseFisica,
      medioNotificacionPrincipal: 'WhatsApp',
    });
    expect(
      errors.some((e) => e.property === 'medioNotificacionPrincipal'),
    ).toBe(true);
  });

  it('rechaza documentos vacíos', async () => {
    const errors = await validar({ ...baseFisica, documentos: [] });
    expect(errors.some((e) => e.property === 'documentos')).toBe(true);
  });

  it('rechaza documento sin tokenReclamo', async () => {
    const errors = await validar({
      ...baseFisica,
      documentos: [{ id: 1, tokenReclamo: '' }],
    });
    expect(errors.some((e) => e.property === 'documentos')).toBe(true);
  });

  it('rechaza ubicación vacía', async () => {
    const errors = await validar({ ...baseFisica, provincia: '  ' });
    expect(errors.some((e) => e.property === 'provincia')).toBe(true);
  });
});
