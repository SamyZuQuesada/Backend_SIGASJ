/* eslint-disable @typescript-eslint/unbound-method -- jest.mocked(service.method) en expects */
import { Test, TestingModule } from '@nestjs/testing';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { PlazoArregloPago } from '../../common/enums/plazo-arreglo-pago.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { PropositoDisponibilidadServiciosConfirmado } from '../../common/enums/proposito-disponibilidad-servicios.enum';
import { PropositoInfraestructuraLinderosConfirmado } from '../../common/enums/proposito-infraestructura-linderos.enum';
import { TipoPersonaDisponibilidadServicios } from '../../common/enums/tipo-persona-disponibilidad-servicios.enum';
import { TipoPersonaInfraestructuraLinderos } from '../../common/enums/tipo-persona-infraestructura-linderos.enum';
import { CreateSolicitudAfiliacionDto } from './dto/create-solicitud-afiliacion.dto';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { CreateSolicitudCambioTitularDto } from './dto/create-solicitud-cambio-titular.dto';
import { CreateSolicitudDisponibilidadServiciosDto } from './dto/create-solicitud-disponibilidad-servicios.dto';
import { CreateSolicitudInfraestructuraLinderosDto } from './dto/create-solicitud-infraestructura-linderos.dto';
import { CreateSolicitudConstanciaServicioDto } from './dto/create-solicitud-constancia-servicio.dto';
import { MotivoConstanciaServicio } from '../../common/enums/motivo-constancia-servicio.enum';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

describe('SolicitudesController', () => {
  let controller: SolicitudesController;
  let service: SolicitudesService;

  const mockSolicitud: Solicitud = {
    id: 1,
    tipoSolicitudId: 1,
    tipoSolicitud: {
      id: 1,
      nombre: 'Solicitud de Arreglo de Pago Domiciliar',
      descripcion: 'Convenio de pago',
      slug: TipoSolicitudSlug.ARREGLO_PAGO,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    codigoSeguimiento: 'SOL-2026-00001',
    estado: EstadoSolicitud.PENDIENTE,
    fechaIngreso: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    establecerValoresPorDefecto: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesController],
      providers: [
        {
          provide: SolicitudesService,
          useValue: {
            findAprobadasPendientes: jest.fn().mockResolvedValue({
              solicitudes: [],
              mensaje: null,
            }),
            findByCodigoSeguimiento: jest.fn().mockResolvedValue(mockSolicitud),
            findById: jest.fn().mockResolvedValue(mockSolicitud),
            findAll: jest.fn().mockResolvedValue({
              solicitudes: [mockSolicitud],
              total: 1,
            }),
            crearSolicitudArregloPago: jest
              .fn()
              .mockResolvedValue(mockSolicitud),
            crearSolicitudCambioTitular: jest
              .fn()
              .mockResolvedValue(mockSolicitud),
            crearSolicitudInfraestructuraLinderos: jest
              .fn()
              .mockResolvedValue(mockSolicitud),
            crearSolicitudAfiliacion: jest
              .fn()
              .mockResolvedValue(mockSolicitud),
            crearSolicitudDisponibilidadServicios: jest
              .fn()
              .mockResolvedValue(mockSolicitud),
            crearSolicitudConstanciaServicio: jest
              .fn()
              .mockResolvedValue(mockSolicitud),
            subirDocumentoSolicitud: jest.fn().mockResolvedValue({
              id: 1,
              tipoDocumento: 'identificacion',
              nombreOriginal: 'cedula.pdf',
              nombreInterno: '123-cedula.pdf',
              mimeType: 'application/pdf',
              tipoArchivo: 'application/pdf',
              tamano: 1024,
              tamanio: 1024,
              ubicacion: '/uploads/solicitudes/pendientes/123-cedula.pdf',
              tokenReclamo: 'tok123',
              fechaCarga: new Date(),
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<SolicitudesController>(SolicitudesController);
    service = module.get<SolicitudesService>(SolicitudesService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('crearArregloPago debe delegar el registro en el servicio', async () => {
    const dto: CreateSolicitudArregloPagoDto = {
      nombre: 'Juan Rodríguez',
      cedula: '1-1234-0567',
      vecinoDe: 'San Juan',
      telefono: '8888-1234',
      numeroCuentaServicio: 'CTA-12345',
      montoPrimaInicial: 20000,
      plazoSeleccionado: PlazoArregloPago.MESES_6,
    };

    const result = await controller.crearArregloPago(dto);
    expect(jest.mocked(service.crearSolicitudArregloPago)).toHaveBeenCalledWith(
      dto,
    );
    expect(result).toEqual(mockSolicitud);
  });

  it('crearCambioTitular debe delegar el registro en el servicio', async () => {
    const dto: CreateSolicitudCambioTitularDto = {
      nombreSolicitante: 'Ana Vargas',
      identificacionSolicitante: '1-1111-1111',
      telefono: '8888-0000',
      nombrePropietarioRegistral: 'Carlos Mora',
      identificacionPropietario: '1-2222-2222',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      nis: 'NIS-1',
      facturaANombreDe: 'Carlos Mora',
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    };

    const result = await controller.crearCambioTitular(dto);
    expect(
      jest.mocked(service.crearSolicitudCambioTitular),
    ).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockSolicitud);
  });

  it('crearInfraestructuraLinderos debe delegar el registro en el servicio', async () => {
    const dto: CreateSolicitudInfraestructuraLinderosDto = {
      nis: 'NIS-77881',
      tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
      nombreFisica: 'María',
      apellidosFisica: 'Rodríguez',
      identificacionFisica: '1-1234-0567',
      telefonoFisica: '8888-1234',
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro',
      direccionExacta: '100 m norte',
      planoCatastrado: 'SJ-1',
      planoAgrimensura: 'AG-1',
      proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
      documentos: [
        { id: 1, tokenReclamo: 'tok-id' },
        { id: 2, tokenReclamo: 'tok-pc' },
        { id: 3, tokenReclamo: 'tok-pa' },
      ],
    };

    const result = await controller.crearInfraestructuraLinderos(dto);
    expect(
      jest.mocked(service.crearSolicitudInfraestructuraLinderos),
    ).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockSolicitud);
  });

  it('crearAfiliacion debe delegar el registro en el servicio', async () => {
    const dto: CreateSolicitudAfiliacionDto = {
      fechaSolicitud: '2026-10-23',
      nombre: 'María Elena Rodríguez Vargas',
      identificacion: '1-1234-0567',
      vecinoDe: 'San Juan',
      estadoCivil: 'Casado(a)',
      telefono: '8888-1234',
      correoElectronico: 'maria@ejemplo.com',
      numeroAbonado: '45892',
      numeroPlano: 'SJ-1',
      recomendacion1Nombre: 'Carlos Mora',
      recomendacion1Identificacion: '1-0987-6543',
      recomendacion1NumeroAbonado: '12045',
      recomendacion2Nombre: 'Ana Vargas',
      recomendacion2Identificacion: '1-2345-6789',
      recomendacion2NumeroAbonado: '13088',
    };

    const result = await controller.crearAfiliacion(dto);
    expect(jest.mocked(service.crearSolicitudAfiliacion)).toHaveBeenCalledWith(
      dto,
    );
    expect(result).toEqual(mockSolicitud);
  });

  it('crearDisponibilidadServicios debe delegar el registro en el servicio', async () => {
    const dto: CreateSolicitudDisponibilidadServiciosDto = {
      tipoPersona: TipoPersonaDisponibilidadServicios.FISICA,
      nombreFisica: 'María',
      primerApellidoFisica: 'Rodríguez',
      segundoApellidoFisica: 'Vargas',
      identificacionFisica: '1-1234-0567',
      telefonoFisica: '8888-1234',
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro',
      direccionExacta: '100 m norte',
      planoCatastrado: 'SJ-1',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      proposito: PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
      descripcionProyecto: 'Proyecto habitacional',
      autorizacionInspeccion: true,
      documentos: [
        { id: 1, tokenReclamo: 'tok-id' },
        { id: 2, tokenReclamo: 'tok-pc' },
      ],
    };

    const result = await controller.crearDisponibilidadServicios(dto);
    expect(
      jest.mocked(service.crearSolicitudDisponibilidadServicios),
    ).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockSolicitud);
  });

  it('crearServicioExistente y crearConstanciaServicio deben delegar el registro en el servicio', async () => {
    const dto: CreateSolicitudConstanciaServicioDto = {
      tipoServicio: 'Domiciliar',
      nis: 'NIS-45892',
      propietarioInmueble: 'María Elena Rodríguez',
      nombreSolicitante: 'Carlos Mora',
      identificacionSolicitante: '1-1234-0567',
      correoElectronico: 'carlos@ejemplo.com',
      telefono: '8888-1234',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro',
      direccionExacta: '100 m norte',
      motivo: MotivoConstanciaServicio.BONO_VIVIENDA,
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    };

    const res1 = await controller.crearServicioExistente(dto);
    expect(
      jest.mocked(service.crearSolicitudConstanciaServicio),
    ).toHaveBeenCalledWith(dto);
    expect(res1).toEqual(mockSolicitud);

    const res2 = await controller.crearConstanciaServicio(dto);
    expect(res2).toEqual(mockSolicitud);
  });

  it('findByCodigoSeguimiento debe consultar la solicitud por código público', async () => {
    const result = await controller.findByCodigoSeguimiento('SOL-2026-00001');
    expect(jest.mocked(service.findByCodigoSeguimiento)).toHaveBeenCalledWith(
      'SOL-2026-00001',
    );
    expect(result).toEqual(mockSolicitud);
  });

  it('findById debe consultar la solicitud por ID', async () => {
    const result = await controller.findById(1);
    expect(jest.mocked(service.findById)).toHaveBeenCalledWith(1);
    expect(result).toEqual(mockSolicitud);
  });

  it('findAll debe consultar solicitudes con filtros', async () => {
    const query = { estado: EstadoSolicitud.PENDIENTE };
    const result = await controller.findAll(query);
    expect(jest.mocked(service.findAll)).toHaveBeenCalledWith(query);
    expect(result.solicitudes).toHaveLength(1);
  });

  describe('subirDocumento', () => {
    it('debe delegar la subida segura al servicio cuando el archivo y tipo son válidos', async () => {
      const mockFile = {
        originalname: 'cedula.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.7'),
      };

      const res = await controller.subirDocumento(mockFile, 'identificacion');

      expect(jest.mocked(service.subirDocumentoSolicitud)).toHaveBeenCalledWith(
        mockFile,
        'identificacion',
      );
      expect(res.id).toBe(1);
      expect(res.nombreOriginal).toBe('cedula.pdf');
    });

    it('debe lanzar BadRequestException si no se adjunta archivo', () => {
      expect(() =>
        controller.subirDocumento(undefined, 'identificacion'),
      ).toThrow('Debe adjuntar un archivo.');
    });
  });
});
