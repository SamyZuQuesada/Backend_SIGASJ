import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TipoNotificacionAveria } from '../../common/enums/tipo-notificacion-averia.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  NOTIFICACION_AJENA,
  NOTIFICACION_NO_ENCONTRADA,
  NotificacionesAveriasService,
} from './notificaciones-averias.service';
import { NotificacionAveria } from './entities/notificacion-averia.entity';

describe('NotificacionesAveriasService — eventos de inventario', () => {
  const buildService = (registrarMock: jest.Mock) => {
    const service = Object.create(
      NotificacionesAveriasService.prototype,
    ) as NotificacionesAveriasService;
    Object.assign(service, {
      usuarioRepository: {
        find: jest.fn().mockResolvedValue([
          { idUsuario: 1, activo: true, rol: { nombre: Role.ADMINISTRADORA } },
          { idUsuario: 2, activo: true, rol: { nombre: Role.ADMINISTRADORA } },
        ]),
        findOne: jest.fn().mockResolvedValue({ idUsuario: 1, activo: true }),
      },
      notificacionRepository: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn((dto) => dto),
      },
      registrarSiNoExiste: registrarMock,
      logger: { warn: jest.fn(), log: jest.fn() },
    });
    return service;
  };

  describe('1. Solicitud de materiales pendiente (notificar a administradoras)', () => {
    it('debe notificar a cada administradora con el formato exacto requerido', async () => {
      const registrar = jest.fn().mockResolvedValue({ id: 10 });
      const service = buildService(registrar);

      const solicitud = { id: 15, idFontanero: 8 };
      const fontanero = { nombre: 'Juan Pérez' };

      await service.notificarAdministradorasSolicitudMaterialesPendiente(
        solicitud,
        fontanero,
      );

      expect(registrar).toHaveBeenCalledTimes(2);
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_PENDIENTE_ADMINISTRADORA,
          titulo: 'Nueva solicitud de materiales',
          mensaje: 'El fontanero Juan Pérez registró una solicitud de materiales.',
          idSolicitudMateriales: 15,
          idUsuarioDestinatario: 1,
        }),
        undefined,
      );
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_PENDIENTE_ADMINISTRADORA,
          titulo: 'Nueva solicitud de materiales',
          mensaje: 'El fontanero Juan Pérez registró una solicitud de materiales.',
          idSolicitudMateriales: 15,
          idUsuarioDestinatario: 2,
        }),
        undefined,
      );
    });

    it('pasa el manager transaccional cuando se suministra', async () => {
      const registrar = jest.fn().mockResolvedValue({ id: 10 });
      const service = buildService(registrar);
      const mockManager = {} as any;

      await service.notificarAdministradorasSolicitudMaterialesPendiente(
        { id: 15 },
        { nombre: 'Juan Pérez' },
        mockManager,
      );

      expect(registrar).toHaveBeenCalledWith(
        expect.anything(),
        mockManager,
      );
    });
  });

  describe('2. Solicitud de materiales aprobada (notificar al fontanero solicitante)', () => {
    it('debe notificar únicamente al fontanero propietario y no al usuario aprobador', async () => {
      const registrar = jest.fn().mockResolvedValue({ id: 11 });
      const service = buildService(registrar);

      const solicitud = {
        id: 15,
        codigo: 'SM-0015',
        idFontanero: 8,
      };

      await service.notificarFontaneroSolicitudMaterialesAprobada(solicitud);

      expect(registrar).toHaveBeenCalledTimes(1);
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_APROBADA_FONTANERO,
          titulo: 'Solicitud de materiales aprobada',
          mensaje: 'Su solicitud de materiales SM-0015 fue aprobada.',
          idSolicitudMateriales: 15,
          idUsuarioDestinatario: 8,
        }),
        undefined,
      );
    });
  });

  describe('2b. Solicitud de materiales rechazada (notificar al fontanero solicitante)', () => {
    it('debe notificar únicamente al fontanero con el motivo de rechazo', async () => {
      const registrar = jest.fn().mockResolvedValue({ id: 11 });
      const service = buildService(registrar);

      const solicitud = {
        id: 15,
        codigo: 'SM-0015',
        idFontanero: 8,
      };

      await service.notificarFontaneroSolicitudMaterialesRechazada(
        solicitud,
        'Material no disponible en bodega',
      );

      expect(registrar).toHaveBeenCalledTimes(1);
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_RECHAZADA_FONTANERO,
          titulo: 'Solicitud de materiales rechazada',
          mensaje:
            'Su solicitud de materiales SM-0015 fue rechazada. Motivo: Material no disponible en bodega.',
          idSolicitudMateriales: 15,
          idUsuarioDestinatario: 8,
        }),
        undefined,
      );
    });

    it('genera mensaje limpio cuando no se especifica motivo', async () => {
      const registrar = jest.fn().mockResolvedValue({ id: 11 });
      const service = buildService(registrar);

      const solicitud = {
        id: 15,
        codigo: 'SM-0015',
        idFontanero: 8,
      };

      await service.notificarFontaneroSolicitudMaterialesRechazada(
        solicitud,
        null,
      );

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_RECHAZADA_FONTANERO,
          titulo: 'Solicitud de materiales rechazada',
          mensaje: 'Su solicitud de materiales SM-0015 fue rechazada.',
          idSolicitudMateriales: 15,
          idUsuarioDestinatario: 8,
        }),
        undefined,
      );
    });
  });

  describe('3. Salida de inventario registrada (notificar a administradoras)', () => {
    it('debe notificar a cada administradora con idSalidaInventario y datos del fontanero', async () => {
      const registrar = jest.fn().mockResolvedValue({ id: 12 });
      const service = buildService(registrar);

      const movimiento = { id: 28 };
      const usuario = { nombre: 'Juan Pérez' };

      await service.notificarAdministradorasSalidaInventario(
        movimiento,
        usuario,
      );

      expect(registrar).toHaveBeenCalledTimes(2);
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoNotificacionAveria.SALIDA_INVENTARIO_REGISTRADA_ADMINISTRADORA,
          titulo: 'Nueva salida de inventario',
          mensaje: 'El fontanero Juan Pérez registró una salida de materiales.',
          idSalidaInventario: 28,
          idUsuarioDestinatario: 1,
        }),
        undefined,
      );
    });
  });

  describe('4. Alerta de reposición (notificar a administradoras)', () => {
    it('debe notificar a cada administradora con idReposicion y material afectado', async () => {
      const registrar = jest.fn().mockResolvedValue({ id: 13 });
      const service = buildService(registrar);

      const alerta = { id: 5 };
      const material = { nombre: 'Tubo PVC' };

      await service.notificarAdministradorasAlertaReposicion(alerta, material);

      expect(registrar).toHaveBeenCalledTimes(2);
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoNotificacionAveria.ALERTA_REPOSICION_ADMINISTRADORA,
          titulo: 'Alerta de reposición',
          mensaje: 'El material Tubo PVC alcanzó el nivel mínimo de existencias.',
          idReposicion: 5,
          idUsuarioDestinatario: 1,
        }),
        undefined,
      );
    });
  });

  describe('5. Validación de una sola referencia principal en registrarSiNoExiste', () => {
    it('omite registro si vienen múltiples referencias principales', async () => {
      const service = Object.create(
        NotificacionesAveriasService.prototype,
      ) as NotificacionesAveriasService;
      const warnSpy = jest.fn();
      Object.assign(service, {
        logger: { warn: warnSpy },
        usuarioRepository: { findOne: jest.fn() },
      });

      const resultado = await service.registrarSiNoExiste({
        idUsuarioDestinatario: 1,
        idSolicitudMateriales: 10,
        idSalidaInventario: 20,
        tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_PENDIENTE_ADMINISTRADORA,
        titulo: 'Inválido',
        mensaje: 'Dos referencias',
      });

      expect(resultado).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('se requiere exactamente una referencia principal'),
      );
    });

    it('omite registro si no viene ninguna referencia principal', async () => {
      const service = Object.create(
        NotificacionesAveriasService.prototype,
      ) as NotificacionesAveriasService;
      const warnSpy = jest.fn();
      Object.assign(service, {
        logger: { warn: warnSpy },
        usuarioRepository: { findOne: jest.fn() },
      });

      const resultado = await service.registrarSiNoExiste({
        idUsuarioDestinatario: 1,
        tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_PENDIENTE_ADMINISTRADORA,
        titulo: 'Inválido',
        mensaje: 'Cero referencias',
      });

      expect(resultado).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('se requiere exactamente una referencia principal'),
      );
    });
  });

  describe('6. GET /notificaciones (listarPropias)', () => {
    it('devuelve todas las referencias con estructura esperada y cuenta de no leídas', async () => {
      const service = Object.create(
        NotificacionesAveriasService.prototype,
      ) as NotificacionesAveriasService;

      const mockData: Partial<NotificacionAveria>[] = [
        {
          id: 20,
          idAveria: null,
          idSolicitudAusencia: null,
          idSolicitudMateriales: 15,
          idSalidaInventario: null,
          idReposicion: null,
          tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_APROBADA_FONTANERO,
          titulo: 'Solicitud de materiales aprobada',
          mensaje: 'Su solicitud SM-0015 fue aprobada.',
          leida: false,
          fechaCreacion: new Date('2026-10-20T21:30:00.000Z'),
          fechaLectura: null,
        },
      ];

      const findMock = jest.fn().mockResolvedValue(mockData);
      Object.assign(service, {
        notificacionRepository: { find: findMock },
      });

      const user: AuthenticatedUser = {
        userId: '8',
        email: 'fontanero@asadasanjuan.cr',
        role: Role.FONTANERO,
      };

      const result = await service.listarPropias(user);

      expect(findMock).toHaveBeenCalledWith({
        where: { idUsuarioDestinatario: 8 },
        order: { fechaCreacion: 'DESC', id: 'DESC' },
        take: 50,
      });

      expect(result).toEqual({
        data: [
          {
            id: 20,
            idAveria: null,
            idSolicitudAusencia: null,
            idSolicitudMateriales: 15,
            idSalidaInventario: null,
            idReposicion: null,
            tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_APROBADA_FONTANERO,
            titulo: 'Solicitud de materiales aprobada',
            mensaje: 'Su solicitud SM-0015 fue aprobada.',
            leida: false,
            fechaCreacion: new Date('2026-10-20T21:30:00.000Z'),
            fechaLectura: null,
          },
        ],
        noLeidas: 1,
      });
    });
  });

  describe('7. PATCH /notificaciones/:id/lectura (marcarLeida)', () => {
    it('actualiza leida=true y fechaLectura si pertenece al usuario', async () => {
      const service = Object.create(
        NotificacionesAveriasService.prototype,
      ) as NotificacionesAveriasService;

      const mockNotif: Partial<NotificacionAveria> = {
        id: 20,
        idUsuarioDestinatario: 8,
        idSolicitudMateriales: 15,
        tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_APROBADA_FONTANERO,
        titulo: 'Aprobada',
        mensaje: 'Aprobada',
        leida: false,
        fechaCreacion: new Date(),
        fechaLectura: null,
      };

      const saveMock = jest.fn().mockImplementation((entity) => entity);
      Object.assign(service, {
        notificacionRepository: {
          findOne: jest.fn().mockResolvedValue(mockNotif),
          save: saveMock,
        },
      });

      const user: AuthenticatedUser = {
        userId: '8',
        email: 'fontanero@asadasanjuan.cr',
        role: Role.FONTANERO,
      };

      const result = await service.marcarLeida(20, user);

      expect(result.leida).toBe(true);
      expect(result.fechaLectura).toBeInstanceOf(Date);
      expect(saveMock).toHaveBeenCalled();
    });

    it('deniega marcar leída una notificación de otro usuario (403)', async () => {
      const service = Object.create(
        NotificacionesAveriasService.prototype,
      ) as NotificacionesAveriasService;

      const mockNotif: Partial<NotificacionAveria> = {
        id: 20,
        idUsuarioDestinatario: 8,
        leida: false,
      };

      Object.assign(service, {
        notificacionRepository: {
          findOne: jest.fn().mockResolvedValue(mockNotif),
        },
      });

      const ajenoUser: AuthenticatedUser = {
        userId: '99',
        email: 'otro@asadasanjuan.cr',
        role: Role.ADMINISTRADORA,
      };

      await expect(service.marcarLeida(20, ajenoUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.marcarLeida(20, ajenoUser)).rejects.toThrow(
        NOTIFICACION_AJENA,
      );
    });

    it('arroja 404 si la notificación no existe', async () => {
      const service = Object.create(
        NotificacionesAveriasService.prototype,
      ) as NotificacionesAveriasService;

      Object.assign(service, {
        notificacionRepository: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      });

      const user: AuthenticatedUser = {
        userId: '8',
        email: 'fontanero@asadasanjuan.cr',
        role: Role.FONTANERO,
      };

      await expect(service.marcarLeida(999, user)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.marcarLeida(999, user)).rejects.toThrow(
        NOTIFICACION_NO_ENCONTRADA,
      );
    });
  });
});
