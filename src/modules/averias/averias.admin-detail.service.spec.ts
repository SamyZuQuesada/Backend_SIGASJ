import { NotFoundException } from '@nestjs/common';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AveriasService,
  buildFindOneAdminQuery,
  toAdminDetail,
} from './averias.service';
import { Averia } from './entities/averia.entity';

describe('AveriasService.findOneAdmin — mapeo y consulta', () => {
  it('mapea nulls administrativos y no inventa labels de presentación', () => {
    const averia = {
      id: 1,
      codigoSeguimiento: 'AV-2026-0001',
      fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
      nombreReportante: 'María Rodríguez',
      identificacionReportante: null,
      telefonoReportante: '8888-1111',
      correoReportante: null,
      idAbonado: null,
      sectorComunidad: 'San Juan',
      ubicacion: 'Escuela',
      descripcion: 'Fuga',
      estado: EstadoAveria.RECIBIDA,
      tipoAveria: null,
      prioridad: null,
      idFontaneroAsignado: null,
      fechaAsignacion: null,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    } as Averia;

    expect(toAdminDetail(averia)).toMatchObject({
      identificacionReportante: null,
      correoReportante: null,
      abonado: null,
      tipoAveria: null,
      prioridad: null,
      fontanero: null,
      fechaAsignacion: null,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    });
  });

  it('mapea Abonado y Fontanero solo con id', () => {
    const averia = {
      id: 2,
      codigoSeguimiento: 'AV-2026-0002',
      fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
      nombreReportante: 'Juan Pérez',
      identificacionReportante: '1-2345-6789',
      telefonoReportante: '8888-2222',
      correoReportante: 'juan@example.com',
      idAbonado: 14,
      sectorComunidad: 'Carmen',
      ubicacion: 'Tanque',
      descripcion: 'Rotura',
      estado: EstadoAveria.RECIBIDA,
      tipoAveria: 'TUBERIA',
      prioridad: 'ALTA',
      idFontaneroAsignado: 5,
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    } as Averia;

    expect(toAdminDetail(averia).abonado).toEqual({ id: 14 });
    expect(toAdminDetail(averia).fontanero).toEqual({ id: 5 });
    expect(toAdminDetail(averia)).not.toHaveProperty('idAbonado');
    expect(toAdminDetail(averia)).not.toHaveProperty('idFontaneroAsignado');
    expect(toAdminDetail(averia)).not.toHaveProperty('fontaneroAsignado');
  });

  it('lanza NotFoundException si no existe', async () => {
    const getOne = jest.fn().mockResolvedValue(null);
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne,
      }),
    };

    const service = new AveriasService(repository as never);
    await expect(service.findOneAdmin(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOneAdmin(99)).rejects.toMatchObject({
      message: AVERIA_ADMIN_NOT_FOUND,
    });
    expect(getOne).toHaveBeenCalled();
  });

  it('consulta por PK con LEFT JOIN y una sola getOne', () => {
    const select = jest.fn().mockReturnThis();
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select,
      where: jest.fn().mockReturnThis(),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    buildFindOneAdminQuery(repository as never, 25);

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(qb.leftJoin).toHaveBeenCalledWith(
      'averia.fontaneroAsignado',
      'fontanero',
    );
    expect(qb.where).toHaveBeenCalledWith('averia.id = :id', { id: 25 });
    expect(select).toHaveBeenCalledWith(
      expect.arrayContaining(['fontanero.idUsuario', 'averia.id']),
    );
    expect(select).not.toHaveBeenCalledWith(
      expect.arrayContaining(['password']),
    );
  });
});
