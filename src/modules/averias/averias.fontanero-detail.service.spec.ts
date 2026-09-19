import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Role } from '../../common/enums/role.enum';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AVERIA_FONTANERO_FORBIDDEN,
  AveriasService,
  buildFindOneFontaneroQuery,
  OBSERVACIONES_ATENCION_VACIAS,
  PRIORIDAD_AVERIA_SIN_ASIGNAR,
  resolveAuthenticatedUsuarioId,
  TIPO_AVERIA_SIN_CLASIFICAR,
  toFontaneroDetail,
} from './averias.service';
import { Averia } from './entities/averia.entity';

const userA = (id: number): AuthenticatedUser => ({
  userId: String(id),
  idUsuario: id,
  email: 'fontanero.a@asadasanjuan.cr',
  role: Role.FONTANERO,
  name: 'Fontanero A',
});

describe('AveriasService.findOneFontanero — mapeo y autorización', () => {
  it('mapea pendientes sin inventar datos del reportante extra', () => {
    const averia = {
      id: 25,
      codigoSeguimiento: 'AV-2026-0025',
      fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
      estado: EstadoAveria.ASIGNADA,
      sectorComunidad: 'San Juan',
      ubicacion: 'Frente a la escuela',
      descripcion: 'Fuga visible',
      nombreReportante: 'María Rodríguez',
      identificacionReportante: '1-2345-6789',
      telefonoReportante: '8888-1111',
      correoReportante: 'maria@example.com',
      idAbonado: 14,
      tipoAveria: null,
      prioridad: null,
      idFontaneroAsignado: 7,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    } as Averia;

    const detail = toFontaneroDetail(averia);
    expect(detail).toMatchObject({
      id: 25,
      codigoSeguimiento: 'AV-2026-0025',
      estado: EstadoAveria.ASIGNADA,
      sectorComunidad: 'San Juan',
      ubicacion: 'Frente a la escuela',
      descripcion: 'Fuga visible',
      nombreReportante: 'María Rodríguez',
      telefonoReportante: '8888-1111',
      tipoAveria: TIPO_AVERIA_SIN_CLASIFICAR,
      prioridad: PRIORIDAD_AVERIA_SIN_ASIGNAR,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: OBSERVACIONES_ATENCION_VACIAS,
      observaciones: [],
    });
    expect(detail).not.toHaveProperty('identificacionReportante');
    expect(detail).not.toHaveProperty('correoReportante');
    expect(detail).not.toHaveProperty('abonado');
    expect(detail).not.toHaveProperty('idAbonado');
    expect(detail).not.toHaveProperty('idFontaneroAsignado');
    expect(detail).not.toHaveProperty('fontanero');
    expect(detail).not.toHaveProperty('passwordHash');
  });

  it('conserva tipo, prioridad y observaciones cuando existen', () => {
    const averia = {
      id: 8,
      codigoSeguimiento: 'AV-2026-0008',
      fechaReporte: new Date('2026-09-04T10:00:00.000Z'),
      fechaAsignacion: new Date('2026-09-04T11:00:00.000Z'),
      estado: EstadoAveria.EN_ATENCION,
      sectorComunidad: 'Carmen',
      ubicacion: 'Tanque',
      descripcion: 'Rotura',
      nombreReportante: 'Juan Pérez',
      telefonoReportante: '8888-2222',
      tipoAveria: 'TUBERIA_DANADA',
      prioridad: 'ALTA',
      fechaInicioAtencion: new Date('2026-09-04T12:00:00.000Z'),
      fechaResolucion: new Date('2026-09-04T16:00:00.000Z'),
      observacionesAtencion: 'Tramo reemplazado.',
    } as Averia;

    expect(toFontaneroDetail(averia)).toMatchObject({
      tipoAveria: 'TUBERIA_DANADA',
      prioridad: 'ALTA',
      observacionesAtencion: 'Tramo reemplazado.',
    });
  });

  it('resuelve el id del Fontanero desde el token, no desde el cliente', () => {
    expect(resolveAuthenticatedUsuarioId(userA(7))).toBe(7);
    expect(() =>
      resolveAuthenticatedUsuarioId({
        userId: 'fontanero-a',
        email: 'a@asadasanjuan.cr',
        role: Role.FONTANERO,
      }),
    ).toThrow(ForbiddenException);
  });

  it('consulta por PK sin unir Usuario ni seleccionar secretos', () => {
    const select = jest.fn().mockReturnThis();
    const qb = {
      select,
      where: jest.fn().mockReturnThis(),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    buildFindOneFontaneroQuery(repository as never, 25);

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(qb.where).toHaveBeenCalledWith('averia.id = :id', { id: 25 });
    expect(select).toHaveBeenCalledWith(
      expect.arrayContaining([
        'averia.id',
        'averia.descripcion',
        'averia.nombreReportante',
        'averia.telefonoReportante',
        'averia.idFontaneroAsignado',
      ]),
    );
    expect(select.mock.calls[0][0]).not.toEqual(
      expect.arrayContaining([
        'averia.identificacionReportante',
        'averia.correoReportante',
        'averia.idAbonado',
      ]),
    );
  });

  const mockService = (getOne: jest.Mock) =>
    new AveriasService(
      {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne,
        }),
      } as never,
      {} as never,
    );

  it('lanza 404 si no existe', async () => {
    const service = mockService(jest.fn().mockResolvedValue(null));
    await expect(service.findOneFontanero(25, userA(7))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOneFontanero(25, userA(7))).rejects.toMatchObject({
      message: AVERIA_ADMIN_NOT_FOUND,
    });
  });

  it('lanza 403 si pertenece a otro Fontanero y no mapea el detalle', async () => {
    const service = mockService(
      jest.fn().mockResolvedValue({
        id: 25,
        idFontaneroAsignado: 9,
        codigoSeguimiento: 'AV-2026-0025',
      }),
    );
    await expect(service.findOneFontanero(25, userA(7))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.findOneFontanero(25, userA(7))).rejects.toMatchObject({
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
  });
});
