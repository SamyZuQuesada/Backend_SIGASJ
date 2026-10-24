import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudNoEncontradaException } from './errors/solicitud.errors';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';
import { SolicitudesService } from './solicitudes.service';
import {
  formatearCodigoSeguimiento,
  generarTokenAlfanumerico,
  normalizarCodigoSeguimiento,
  validarFormatoCodigoSeguimiento,
} from './utils/codigo-seguimiento.util';

describe('Tarea 2 - Generación de Referencia Pública Segura (Código de Seguimiento)', () => {
  let service: SolicitudesService;
  let solicitudRepo: Repository<Solicitud>;

  const mockSolicitudRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Solicitud),
          useValue: mockSolicitudRepo,
        },
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: { save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudCambioTitular),
          useValue: { save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudInfraestructuraLinderos),
          useValue: { save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudAfiliacion),
          useValue: { save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudDisponibilidadServicios),
          useValue: { save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudConstanciaServicio),
          useValue: { save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: { find: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: { save: jest.fn(), create: jest.fn(), find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
    solicitudRepo = module.get<Repository<Solicitud>>(
      getRepositoryToken(Solicitud),
    );
  });

  describe('1. Estrategia de generación y formato', () => {
    it('debe generar códigos siguiendo el formato seguro SOL-YYYY-XXXXXX (ej: SOL-2026-A82K91)', async () => {
      mockSolicitudRepo.findOne.mockResolvedValue(null);

      const codigo = await service.generarCodigoSeguimiento();

      expect(codigo).toBeDefined();
      expect(validarFormatoCodigoSeguimiento(codigo)).toBe(true);

      const anioActual = new Date().getFullYear();
      expect(codigo.startsWith(`SOL-${anioActual}-`)).toBe(true);

      const partes = codigo.split('-');
      expect(partes).toHaveLength(3);
      expect(partes[0]).toBe('SOL');
      expect(partes[1]).toBe(String(anioActual));
      expect(partes[2]).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('no debe utilizar directamente el ID incremental ni permitir inferir IDs correlativos consecutivos', async () => {
      mockSolicitudRepo.findOne.mockResolvedValue(null);

      const codigo1 = await service.generarCodigoSeguimiento();
      const codigo2 = await service.generarCodigoSeguimiento();
      const codigo3 = await service.generarCodigoSeguimiento();

      expect(codigo1).not.toBe(codigo2);
      expect(codigo2).not.toBe(codigo3);

      const sufijo1 = codigo1.split('-')[2];
      const sufijo2 = codigo2.split('-')[2];
      const sufijo3 = codigo3.split('-')[2];

      expect(sufijo1).not.toBe(sufijo2);
      expect(sufijo2).not.toBe(sufijo3);
      // No son enteros incrementales correlativos directos
      expect(sufijo2).not.toBe(String(Number(sufijo1) + 1));
    });

    it('debe generar 100 códigos aleatorios consecutivos garantizando entropía y ausencia de duplicados', () => {
      const codigos = new Set<string>();
      const total = 100;

      for (let i = 0; i < total; i++) {
        const codigo = formatearCodigoSeguimiento(2026);
        expect(validarFormatoCodigoSeguimiento(codigo)).toBe(true);
        codigos.add(codigo);
      }

      // Si todos son únicos, el tamaño del set es exactamente 100
      expect(codigos.size).toBe(total);
    });
  });

  describe('2. Garantizar unicidad y manejo de colisiones', () => {
    it('debe verificar la no existencia del código en BD antes de retornarlo', async () => {
      mockSolicitudRepo.findOne.mockResolvedValue(null);

      const codigo = await service.generarCodigoSeguimiento();

      expect(mockSolicitudRepo.findOne).toHaveBeenCalledWith({
        where: { codigoSeguimiento: codigo },
        select: { id: true, codigoSeguimiento: true },
      });
    });

    it('debe detectar una colisión y reintentar automáticamente hasta encontrar un código único', async () => {
      const solicitudExistente = new Solicitud();
      solicitudExistente.id = 99;
      solicitudExistente.codigoSeguimiento = 'SOL-2026-COLIS1';

      // Primer intento: colisión (devuelve solicitud existente)
      // Segundo intento: libre (devuelve null)
      mockSolicitudRepo.findOne
        .mockResolvedValueOnce(solicitudExistente)
        .mockResolvedValueOnce(null);

      const codigo = await service.generarCodigoSeguimiento();

      expect(mockSolicitudRepo.findOne).toHaveBeenCalledTimes(2);
      expect(codigo).not.toBe('SOL-2026-COLIS1');
      expect(validarFormatoCodigoSeguimiento(codigo)).toBe(true);
    });

    it('debe manejar múltiples colisiones consecutivas sin fallar y generar código con entropía extendida', async () => {
      const colision = new Solicitud();
      colision.id = 1;

      // 10 colisiones consecutivas
      mockSolicitudRepo.findOne.mockResolvedValue(colision);

      const codigo = await service.generarCodigoSeguimiento();

      expect(mockSolicitudRepo.findOne).toHaveBeenCalledTimes(10);
      expect(codigo).toBeDefined();
      expect(codigo.startsWith('SOL-')).toBe(true);
      // El fallback agrega más caracteres para asegurar resolución
      expect(codigo.split('-')[2].length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('3. Incorporación del código al registro', () => {
    it('debe asegurar que la entidad Solicitud siempre posee un código de seguimiento al persistirse', () => {
      const solicitud = new Solicitud();
      solicitud.tipoSolicitudId = 1;

      // Se ejecuta hook previo a la inserción sin haber asignado código explícito
      solicitud.establecerValoresPorDefecto();

      expect(solicitud.codigoSeguimiento).toBeDefined();
      expect(validarFormatoCodigoSeguimiento(solicitud.codigoSeguimiento)).toBe(
        true,
      );
    });

    it('debe normalizar a mayúsculas y sin espacios el código asignado en BeforeInsert', () => {
      const solicitud = new Solicitud();
      solicitud.codigoSeguimiento = '   sol-2026-a82k91   ';

      solicitud.establecerValoresPorDefecto();

      expect(solicitud.codigoSeguimiento).toBe('SOL-2026-A82K91');
    });
  });

  describe('4. Evitar modificación posterior (Inmutabilidad y Estabilidad del código)', () => {
    it('debe lanzar BadRequestException si se intenta alterar el código de seguimiento tras su carga', () => {
      const solicitud = new Solicitud();
      solicitud.id = 10;
      solicitud.codigoSeguimiento = 'SOL-2026-A82K91';
      solicitud.capturarCodigoOriginal();

      // Intento de alteración no autorizada del código público
      solicitud.codigoSeguimiento = 'SOL-2026-MODIF1';

      expect(() => solicitud.validarInmutabilidadCodigo()).toThrow(
        BadRequestException,
      );
      expect(() => solicitud.validarInmutabilidadCodigo()).toThrow(
        'El código de seguimiento de una solicitud es inmutable y no puede ser modificado',
      );
    });

    it('debe permitir la modificación de otros campos de la solicitud manteniendo el código estable', () => {
      const solicitud = new Solicitud();
      solicitud.id = 10;
      solicitud.codigoSeguimiento = 'SOL-2026-A82K91';
      solicitud.capturarCodigoOriginal();

      // Transición válida de estado en el ciclo de vida
      solicitud.estado = EstadoSolicitud.EN_REVISION;

      expect(() => solicitud.validarInmutabilidadCodigo()).not.toThrow();
      expect(solicitud.codigoSeguimiento).toBe('SOL-2026-A82K91');
    });

    it('actualizarEstado en el servicio no debe modificar el código de seguimiento', async () => {
      const solicitudOriginal = new Solicitud();
      solicitudOriginal.id = 55;
      solicitudOriginal.codigoSeguimiento = 'SOL-2026-A82K91';
      solicitudOriginal.estado = EstadoSolicitud.PENDIENTE;

      mockSolicitudRepo.findOne.mockResolvedValue(solicitudOriginal);
      mockSolicitudRepo.save.mockImplementation((s: Solicitud) =>
        Promise.resolve(s),
      );

      const actualizada = await service.actualizarEstado(
        55,
        EstadoSolicitud.APROBADA,
      );

      expect(actualizada.estado).toBe(EstadoSolicitud.APROBADA);
      expect(actualizada.codigoSeguimiento).toBe('SOL-2026-A82K91');
      expect(mockSolicitudRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          codigoSeguimiento: 'SOL-2026-A82K91',
          estado: EstadoSolicitud.APROBADA,
        }),
      );
    });
  });

  describe('5. Búsqueda y validación de referencias públicas', () => {
    it('debe consultar la solicitud por código público normalizando minúsculas y espacios', async () => {
      const solicitudEncontrada = new Solicitud();
      solicitudEncontrada.id = 12;
      solicitudEncontrada.codigoSeguimiento = 'SOL-2026-A82K91';

      mockSolicitudRepo.findOne.mockResolvedValue(solicitudEncontrada);

      const resultado =
        await service.findByCodigoSeguimiento('  sol-2026-a82k91  ');

      expect(resultado).toBe(solicitudEncontrada);
      expect(mockSolicitudRepo.findOne).toHaveBeenCalledWith({
        where: { codigoSeguimiento: 'SOL-2026-A82K91' },
        relations: { tipoSolicitud: true },
      });
    });

    it('debe rechazar con BadRequestException si se suministra un código vacío', async () => {
      await expect(service.findByCodigoSeguimiento('   ')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByCodigoSeguimiento('')).rejects.toThrow(
        'El código de seguimiento es requerido',
      );
    });

    it('debe lanzar SolicitudNoEncontradaException si el código no existe en base de datos', async () => {
      mockSolicitudRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByCodigoSeguimiento('SOL-2026-NOEXIST'),
      ).rejects.toThrow(SolicitudNoEncontradaException);
    });
  });
});
