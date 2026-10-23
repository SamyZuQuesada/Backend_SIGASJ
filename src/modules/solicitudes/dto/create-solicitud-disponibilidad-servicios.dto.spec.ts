import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CalidadTitularCambioTitular } from '../../../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { PropositoDisponibilidadServiciosConfirmado } from '../../../common/enums/proposito-disponibilidad-servicios.enum';
import { TipoPersonaDisponibilidadServicios } from '../../../common/enums/tipo-persona-disponibilidad-servicios.enum';
import { CreateSolicitudDisponibilidadServiciosDto } from './create-solicitud-disponibilidad-servicios.dto';

describe('CreateSolicitudDisponibilidadServiciosDto', () => {
  const documentosBase = [
    { id: 1, tokenReclamo: 'token-identificacion-001' },
    { id: 2, tokenReclamo: 'token-plano-catastrado-002' },
  ];

  const baseFisica = {
    tipoPersona: TipoPersonaDisponibilidadServicios.FISICA,
    nombreFisica: 'María Elena',
    primerApellidoFisica: 'Rodríguez',
    segundoApellidoFisica: 'Vargas',
    identificacionFisica: '1-1234-0567',
    telefonoFisica: '8888-1234',
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    valorNotificacionPrincipal: 'maria@ejemplo.com',
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'San Isidro de El General',
    direccionExacta: '100 m norte de la iglesia',
    planoCatastrado: 'SJ-1234567-2020',
    naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    proposito: PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
    descripcionProyecto: 'Construcción de 4 unidades habitacionales',
    autorizacionInspeccion: true,
    documentos: documentosBase,
  };

  const baseJuridica = {
    tipoPersona: TipoPersonaDisponibilidadServicios.JURIDICA,
    razonSocial: 'Inversiones del Valle S.A.',
    identificacionJuridica: '3-101-123456',
    nombreRepresentante: 'Luis Alberto Mora Chaves',
    identificacionRepresentante: '1-0987-6543',
    telefonoRepresentante: '8777-4321',
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'Daniel Flores',
    direccionExacta: 'Frente a la escuela',
    planoCatastrado: 'SJ-999',
    naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
    calidadTitular: CalidadTitularCambioTitular.REPRESENTANTE_LEGAL,
    proposito: PropositoDisponibilidadServiciosConfirmado.URBANIZACION,
    descripcionProyecto: 'Urbanización residencial fase 1',
    autorizacionInspeccion: true,
    documentos: [...documentosBase, { id: 3, tokenReclamo: 'token-poder-003' }],
  };

  const validar = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(
      CreateSolicitudDisponibilidadServiciosDto,
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

  it.each(Object.values(PropositoDisponibilidadServiciosConfirmado))(
    'acepta propósito confirmado "%s"',
    async (proposito) => {
      const errors = await validar({ ...baseFisica, proposito });
      expect(errors.some((e) => e.property === 'proposito')).toBe(false);
    },
  );

  it('rechaza descripción de proyecto ausente o vacía', async () => {
    const sinDesc = { ...baseFisica };
    delete (sinDesc as { descripcionProyecto?: string }).descripcionProyecto;
    expect(
      (await validar(sinDesc)).some(
        (e) => e.property === 'descripcionProyecto',
      ),
    ).toBe(true);

    expect(
      (await validar({ ...baseFisica, descripcionProyecto: '   ' })).some(
        (e) => e.property === 'descripcionProyecto',
      ),
    ).toBe(true);
  });

  it('rechaza propósito inválido', async () => {
    const errors = await validar({
      ...baseFisica,
      proposito: 'Ampliación inventada',
    });
    expect(errors.some((e) => e.property === 'proposito')).toBe(true);
  });

  it('rechaza naturaleza inválida', async () => {
    const errors = await validar({
      ...baseFisica,
      naturalezaInmueble: 'Terreno espacial',
    });
    expect(errors.some((e) => e.property === 'naturalezaInmueble')).toBe(true);
  });

  it('rechaza calidad inválida', async () => {
    const errors = await validar({
      ...baseFisica,
      calidadTitular: 'Arrendatario inventado',
    });
    expect(errors.some((e) => e.property === 'calidadTitular')).toBe(true);
  });

  it('persona física sin identificación → rechazo', async () => {
    const sinId = { ...baseFisica };
    delete (sinId as { identificacionFisica?: string }).identificacionFisica;
    expect(
      (await validar(sinId)).some((e) => e.property === 'identificacionFisica'),
    ).toBe(true);
  });

  it('persona física no exige campos jurídicos', async () => {
    const errors = await validar(baseFisica);
    expect(errors.some((e) => e.property === 'razonSocial')).toBe(false);
  });

  it('persona jurídica sin razón social → rechazo', async () => {
    const sinRazon = { ...baseJuridica };
    delete (sinRazon as { razonSocial?: string }).razonSocial;
    expect(
      (await validar(sinRazon)).some((e) => e.property === 'razonSocial'),
    ).toBe(true);
  });

  it('rechaza área negativa y caudal negativo', async () => {
    expect(
      (await validar({ ...baseFisica, areaConstruccion: -1 })).some(
        (e) => e.property === 'areaConstruccion',
      ),
    ).toBe(true);
    expect(
      (await validar({ ...baseFisica, caudalRequerido: -0.5 })).some(
        (e) => e.property === 'caudalRequerido',
      ),
    ).toBe(true);
  });

  it('acepta campos de proyecto opcionales y decimales', async () => {
    const errors = await validar({
      ...baseFisica,
      cantidadDormitorios: 3,
      unidadesHabitacionales: 4,
      areaConstruccion: 185.5,
      niveles: 2,
      caudalRequerido: 0.75,
      numeroDisponibilidadAnterior: 'DISP-2024-001',
      nis: 'NIS-45892',
    });
    expect(errors).toHaveLength(0);
  });

  it('rechaza autorización de inspección no booleana (1/0)', async () => {
    expect(
      (await validar({ ...baseFisica, autorizacionInspeccion: 1 })).some(
        (e) => e.property === 'autorizacionInspeccion',
      ),
    ).toBe(true);
  });

  it('acepta autorizacionInspeccion false', async () => {
    const errors = await validar({
      ...baseFisica,
      autorizacionInspeccion: false,
    });
    expect(errors.some((e) => e.property === 'autorizacionInspeccion')).toBe(
      false,
    );
  });

  it('rechaza documentos vacíos', async () => {
    const errors = await validar({ ...baseFisica, documentos: [] });
    expect(errors.some((e) => e.property === 'documentos')).toBe(true);
  });

  it('conserva identificación con ceros/guiones como string', async () => {
    const dto = plainToInstance(CreateSolicitudDisponibilidadServiciosDto, {
      ...baseFisica,
      identificacionFisica: '01-0234-0005',
    });
    expect(dto.identificacionFisica).toBe('01-0234-0005');
    expect(await validate(dto)).toHaveLength(0);
  });
});
