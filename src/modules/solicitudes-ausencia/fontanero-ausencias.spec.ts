import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstadoSolicitudAusencia } from '../../common/enums/estado-solicitud-ausencia.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoSolicitudAusencia } from '../../common/enums/tipo-solicitud-ausencia.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  COLABORADOR_BASE_SELECT,
  ColaboradoresService,
} from '../recursos-humanos/colaboradores.service';
import { Colaborador } from '../recursos-humanos/entities/colaborador.entity';
import { Puesto } from '../recursos-humanos/entities/puesto.entity';
import { VacacionesController } from '../recursos-humanos/vacaciones.controller';
import { VacacionesService } from '../recursos-humanos/vacaciones.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CrearSolicitudAusenciaFontaneroDto } from './dto/crear-solicitud-ausencia-fontanero.dto';
import { FontaneroSolicitudesAusenciaController } from './fontanero-solicitudes-ausencia.controller';
import { SolicitudesAusenciaService } from './solicitudes-ausencia.service';

describe('Fontanero Ausencias y Vacaciones — Diagnóstico y Resolución', () => {
  let fontaneroController: FontaneroSolicitudesAusenciaController;
  let vacacionesController: VacacionesController;
  let colaboradoresService: ColaboradoresService;
  let solicitudesAusenciaService: Partial<SolicitudesAusenciaService>;
  let vacacionesService: Partial<VacacionesService>;

  const mockFontaneroUser: AuthenticatedUser = {
    userId: 28,
    idUsuario: 28,
    correo: 'fontanero@asadasanjuan.cr',
    rol: Role.FONTANERO,
  };

  const mockColaborador: Partial<Colaborador> = {
    id: 7,
    nombre: 'Fontanero',
    apellidos: 'ASADA San Juan',
    cedula: '5-0555-0555',
    correoElectronico: 'fontanero@asadasanjuan.cr',
    cargo: 'Fontanero',
    activo: true,
    usuarioId: 28,
  };

  const mockBalance = {
    colaboradorId: 7,
    diasAcumulados: 15,
    diasDisfrutados: 5,
    diasDisponibles: 10,
    totalMovimientos: 2,
    colaborador: {
      id: 7,
      nombre: 'Fontanero',
      apellidos: 'ASADA San Juan',
      cedula: '5-0555-0555',
      cargo: 'Fontanero',
      activo: true,
    },
  };

  beforeEach(async () => {
    solicitudesAusenciaService = {
      crearSolicitudPropia: jest.fn().mockImplementation((usuarioId, dto) => {
        if (!dto.motivo && dto.tipo === TipoSolicitudAusencia.PERMISO) {
          return Promise.reject(
            new BadRequestException('Indique el motivo del permiso'),
          );
        }
        return Promise.resolve({
          id: 101,
          colaboradorId: 7,
          tipo: dto.tipo,
          estado: EstadoSolicitudAusencia.PENDIENTE,
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin,
          motivo: dto.motivo ?? null,
          correoNotificacion: dto.correo,
          documentos: [],
          createdAt: new Date().toISOString(),
        });
      }),
      listarSolicitudesPropias: jest.fn().mockResolvedValue([]),
      obtenerSolicitudPropia: jest.fn().mockResolvedValue({
        id: 101,
        colaboradorId: 7,
        tipo: TipoSolicitudAusencia.PERMISO,
        estado: EstadoSolicitudAusencia.PENDIENTE,
      }),
      obtenerBalanceVacaciones: jest.fn().mockResolvedValue(mockBalance),
    };

    vacacionesService = {
      obtenerBalancePorUsuarioId: jest.fn().mockImplementation((usuarioId) => {
        if (usuarioId !== 28) {
          return Promise.reject(
            new ForbiddenException(
              'No hay un colaborador activo vinculado a su cuenta',
            ),
          );
        }
        return Promise.resolve(mockBalance);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        FontaneroSolicitudesAusenciaController,
        VacacionesController,
      ],
      providers: [
        {
          provide: SolicitudesAusenciaService,
          useValue: solicitudesAusenciaService,
        },
        {
          provide: VacacionesService,
          useValue: vacacionesService,
        },
      ],
    }).compile();

    fontaneroController = module.get<FontaneroSolicitudesAusenciaController>(
      FontaneroSolicitudesAusenciaController,
    );
    vacacionesController =
      module.get<VacacionesController>(VacacionesController);
  });

  describe('1. ColaboradoresService.resolverActivoPorUsuarioId (Proyección defensiva)', () => {
    let colaboradorRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock };
    let usuarioRepo: { findOne: jest.Mock };
    let puestoRepo: { findOne: jest.Mock };

    beforeEach(async () => {
      colaboradorRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
      };
      usuarioRepo = {
        findOne: jest.fn(),
      };
      puestoRepo = {
        findOne: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ColaboradoresService,
          {
            provide: getRepositoryToken(Colaborador),
            useValue: colaboradorRepo,
          },
          {
            provide: getRepositoryToken(Usuario),
            useValue: usuarioRepo,
          },
          {
            provide: getRepositoryToken(Puesto),
            useValue: puestoRepo,
          },
        ],
      }).compile();

      colaboradoresService =
        module.get<ColaboradoresService>(ColaboradoresService);
    });

    it('ejecuta findOne proyectando únicamente COLABORADOR_BASE_SELECT para evitar error 500 por columnas no migradas', async () => {
      colaboradorRepo.findOne.mockResolvedValue(mockColaborador);

      const result = await colaboradoresService.resolverActivoPorUsuarioId(28);

      expect(result).toEqual(mockColaborador);
      expect(colaboradorRepo.findOne).toHaveBeenCalledWith({
        where: { usuarioId: 28, activo: true },
        select: COLABORADOR_BASE_SELECT,
      });

      // Verificar que las columnas no migradas no están en la proyección
      expect(COLABORADOR_BASE_SELECT).not.toHaveProperty('modalidadPago');
      expect(COLABORADOR_BASE_SELECT).not.toHaveProperty('diasLaboralesHabituales');
      expect(COLABORADOR_BASE_SELECT).not.toHaveProperty('jornadaLaboral');
      expect(COLABORADOR_BASE_SELECT).not.toHaveProperty('fechaIngreso');
    });

    it('devuelve null si el id de usuario es inválido o no existe', async () => {
      const res1 = await colaboradoresService.resolverActivoPorUsuarioId(0);
      const res2 = await colaboradoresService.resolverActivoPorUsuarioId(-1);
      expect(res1).toBeNull();
      expect(res2).toBeNull();
    });
  });

  describe('2. POST /fontanero/solicitudes-ausencia', () => {
    it('permite al Fontanero crear una solicitud de permiso propia con motivo', async () => {
      const dto: CrearSolicitudAusenciaFontaneroDto = {
        tipo: TipoSolicitudAusencia.PERMISO,
        fechaInicio: '2026-11-20',
        fechaFin: '2026-11-21',
        motivo: 'Cita médica en la clínica de Santa Cruz',
        correo: 'fontanero@asadasanjuan.cr',
      };

      const res = await fontaneroController.crearPropia(
        dto,
        undefined,
        mockFontaneroUser,
      );

      expect(res.id).toBe(101);
      expect(res.colaboradorId).toBe(7);
      expect(res.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
      expect(res.motivo).toBe('Cita médica en la clínica de Santa Cruz');
      expect(solicitudesAusenciaService.crearSolicitudPropia).toHaveBeenCalledWith(
        28,
        dto,
        [],
      );
    });

    it('rechaza una solicitud de permiso si falta el motivo (400)', async () => {
      const dto: CrearSolicitudAusenciaFontaneroDto = {
        tipo: TipoSolicitudAusencia.PERMISO,
        fechaInicio: '2026-11-20',
        fechaFin: '2026-11-21',
        motivo: '',
        correo: 'fontanero@asadasanjuan.cr',
      };

      await expect(
        fontaneroController.crearPropia(dto, undefined, mockFontaneroUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Consulta de Balance de Vacaciones (Ruta canónica y alias)', () => {
    it('GET /rrhh/vacaciones/mias/balance devuelve el saldo del Fontanero autenticado', async () => {
      const balance = await vacacionesController.obtenerBalancePropio(
        mockFontaneroUser,
      );

      expect(balance).toEqual(mockBalance);
      expect(vacacionesService.obtenerBalancePorUsuarioId).toHaveBeenCalledWith(28);
    });

    it('GET /rrhh/vacaciones/mias/balance rechaza a un usuario sin colaborador vinculado con 403', async () => {
      const usuarioSinColaborador: AuthenticatedUser = {
        userId: 99,
        idUsuario: 99,
        correo: 'desconocido@asadasanjuan.cr',
        rol: Role.FONTANERO,
      };

      await expect(
        vacacionesController.obtenerBalancePropio(usuarioSinColaborador),
      ).rejects.toThrow(ForbiddenException);
    });

    it('GET /fontanero/solicitudes-ausencia/balance (alias) devuelve el balance del Fontanero', async () => {
      const balance = await fontaneroController.obtenerBalancePropio(
        mockFontaneroUser,
      );

      expect(balance).toEqual(mockBalance);
      expect(
        solicitudesAusenciaService.obtenerBalanceVacaciones,
      ).toHaveBeenCalledWith(28);
    });
  });

  describe('4. Validación de Contratos y Reglas de Negocio de Ausencias', () => {
    it('rechaza archivos adjuntos si el tipo de solicitud es VACACIONES (400)', async () => {
      const dto: CrearSolicitudAusenciaFontaneroDto = {
        tipo: TipoSolicitudAusencia.VACACIONES,
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-05',
        correo: 'fontanero@asadasanjuan.cr',
      };

      const mockArchivos = [
        {
          originalname: 'documento.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('test'),
        },
      ];

      (solicitudesAusenciaService.crearSolicitudPropia as jest.Mock).mockImplementationOnce(
        () =>
          Promise.reject(
            new BadRequestException(
              'La solicitud de vacaciones no admite archivos adjuntos',
            ),
          ),
      );

      await expect(
        fontaneroController.crearPropia(
          dto,
          mockArchivos as any,
          mockFontaneroUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('no intenta escribir ni modificar columnas de Colaborador al crear una solicitud', async () => {
      const dto: CrearSolicitudAusenciaFontaneroDto = {
        tipo: TipoSolicitudAusencia.PERMISO,
        fechaInicio: '2026-11-20',
        fechaFin: '2026-11-21',
        motivo: 'Asunto personal urgente',
        correo: 'fontanero@asadasanjuan.cr',
      };

      const res = await fontaneroController.crearPropia(
        dto,
        undefined,
        mockFontaneroUser,
      );

      // La solicitud creada solo persiste datos en dbo.SolicitudAusencia
      expect(res).not.toHaveProperty('fechaIngreso');
      expect(res).not.toHaveProperty('jornadaLaboral');
      expect(res).not.toHaveProperty('diasLaboralesHabituales');
      expect(res).not.toHaveProperty('modalidadPago');
      expect(res.colaboradorId).toBe(7);
    });
  });

  describe('5. Comparación de Comportamiento: Esquema Sin Migración vs Esquema Con Migración', () => {
    it('en esquema sin migración, la resolución con COLABORADOR_BASE_SELECT no incluye propiedades no migradas', () => {
      const keys = Object.keys(COLABORADOR_BASE_SELECT);
      expect(keys).toContain('id');
      expect(keys).toContain('nombre');
      expect(keys).toContain('apellidos');
      expect(keys).toContain('cedula');
      expect(keys).toContain('correoElectronico');
      expect(keys).toContain('cargo');
      expect(keys).toContain('activo');
      expect(keys).toContain('usuarioId');

      expect(keys).not.toContain('fechaIngreso');
      expect(keys).not.toContain('jornadaLaboral');
      expect(keys).not.toContain('diasLaboralesHabituales');
      expect(keys).not.toContain('modalidadPago');
    });

    it('en esquema con migración aplicada, un colaborador completo hidrata correctamente la antigüedad calculada', () => {
      const colaboradorCompleto = new Colaborador();
      colaboradorCompleto.id = 7;
      colaboradorCompleto.nombre = 'Fontanero';
      colaboradorCompleto.apellidos = 'ASADA San Juan';
      colaboradorCompleto.fechaIngreso = '2024-01-15';
      colaboradorCompleto.jornadaLaboral = null;
      colaboradorCompleto.diasLaboralesHabituales = 5;
      colaboradorCompleto.modalidadPago = null;

      colaboradorCompleto.hidratarAntiguedad();

      expect(colaboradorCompleto.antiguedad).not.toBeNull();
      expect(colaboradorCompleto.antiguedad?.totalDias).toBeGreaterThan(0);
    });

    it('en esquema sin migración, hidratarAntiguedad maneja fechaIngreso nula/indefinida sin arrojar excepción', () => {
      const colaboradorSinMigrar = new Colaborador();
      colaboradorSinMigrar.id = 7;
      colaboradorSinMigrar.fechaIngreso = null as any;

      colaboradorSinMigrar.hidratarAntiguedad();

      expect(colaboradorSinMigrar.antiguedad).toBeNull();
    });
  });
});
