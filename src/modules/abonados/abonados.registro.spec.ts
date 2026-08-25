import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { AbonadosService } from './abonados.service';
import { Abonado } from './entities/abonado.entity';
import { SolicitudServicio } from '../solicitudes/entities/solicitud-servicio.entity';
import { Servicio } from '../servicios/entities/servicio.entity';

describe('AbonadosService.register — Tarea #339', () => {
  let service: AbonadosService;
  let abonadoExist: jest.Mock;
  let servicioExist: jest.Mock;
  let solicitudFindOne: jest.Mock;
  let transaction: jest.Mock;

  const dto: CreateAbonadoDto = {
    idSolicitud: 1,
    nombre: 'María',
    apellidos: 'Rodríguez Mora',
    cedula: '1-2345-6789',
    telefono: '8888-1234',
    correo: 'maria.rodriguez@correo.cr',
    direccion: 'San Juan, Desamparados',
    servicio: {
      nis: 'NIS-2026-001',
      medidor: 'MED-45821',
      sector: 'Sector Centro',
      tarifa: 'Residencial',
      numeroPlano: 'PL-1024',
    },
  };

  beforeEach(async () => {
    abonadoExist = jest.fn().mockResolvedValue(false);
    servicioExist = jest.fn().mockResolvedValue(false);
    solicitudFindOne = jest.fn().mockResolvedValue({
      idSolicitud: 1,
      estado: SolicitudEstado.APROBADA,
      utilizada: false,
    });

    transaction = jest.fn(async (work) => {
      const manager = {
        create: (_entity: unknown, payload: object) => payload,
        save: jest
          .fn()
          .mockResolvedValueOnce({ idUsuario: 50 })
          .mockResolvedValueOnce({ idAbonado: 12, ...dto })
          .mockResolvedValueOnce({ idServicio: 7 })
          .mockResolvedValueOnce(undefined),
        findOne: solicitudFindOne,
        getRepository: () => ({ findOne: solicitudFindOne }),
      };
      return work(manager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbonadosService,
        {
          provide: getRepositoryToken(Abonado),
            useValue: { findOne: jest.fn(), exists: abonadoExist },
        },
        {
          provide: getRepositoryToken(Servicio),
            useValue: { exists: servicioExist },
        },
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { findOne: solicitudFindOne },
        },
        {
          provide: DataSource,
          useValue: { transaction },
        },
      ],
    }).compile();

    service = module.get(AbonadosService);
  });

  it('registra abonado y servicio en una sola operación', async () => {
    const result = await service.register(dto);

    expect(result).toEqual({
      idAbonado: 12,
      mensaje: 'Abonado y servicio registrados correctamente.',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rechaza cédula duplicada', async () => {
    abonadoExist.mockResolvedValueOnce(true);

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rechaza NIS duplicado', async () => {
    servicioExist.mockImplementation(({ where }: { where: { nis?: string } }) =>
      Promise.resolve(Boolean(where.nis)),
    );

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza medidor duplicado', async () => {
    servicioExist.mockImplementation(({ where }: { where: { medidor?: string } }) =>
      Promise.resolve(Boolean(where.medidor)),
    );

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
