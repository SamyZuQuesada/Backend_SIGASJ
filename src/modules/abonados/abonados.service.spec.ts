import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AbonadosService } from './abonados.service';
import { Abonado } from './entities/abonado.entity';
import { SolicitudServicio } from '../solicitudes/entities/solicitud-servicio.entity';
import { Servicio } from '../servicios/entities/servicio.entity';

describe('AbonadosService — IDOR / propiedad', () => {
  let service: AbonadosService;
  let findOne: jest.Mock;

  const abonado10 = {
    idAbonado: 10,
    idUsuario: 10,
    usuario: { idUsuario: 10 },
  };

  const abonado11 = {
    idAbonado: 11,
    idUsuario: 11,
    usuario: { idUsuario: 11 },
  };

  const userAbonado10: AuthenticatedUser = {
    userId: '10',
    email: 'abonado10@asadasanjuan.cr',
    role: Role.ABONADO,
    name: 'Abonado 10',
  };

  const adminUser: AuthenticatedUser = {
    userId: '1',
    email: 'admin@asadasanjuan.cr',
    role: Role.ADMINISTRADORA,
    name: 'Administradora',
  };

  beforeEach(async () => {
    findOne = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbonadosService,
        {
          provide: getRepositoryToken(Abonado),
          useValue: { findOne, exist: jest.fn() },
        },
        {
          provide: getRepositoryToken(Servicio),
          useValue: { exist: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AbonadosService);
  });

  it('GET conceptual /abonados/10: Abonado 10 accede a su registro', async () => {
    findOne.mockResolvedValue(abonado10);

    await expect(
      service.findOneForRequester(10, userAbonado10),
    ).resolves.toEqual(abonado10);
    expect(findOne).toHaveBeenCalledWith({
      where: { idAbonado: 10, idUsuario: 10 },
    });
    expect(findOne).not.toHaveBeenCalledWith({ where: {} });
  });

  it('GET conceptual /abonados/11: Abonado 10 recibe 403', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.findOneForRequester(11, userAbonado10),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOne).toHaveBeenCalledWith({
      where: { idAbonado: 11, idUsuario: 10 },
    });
  });

  it('no carga el padrón completo para filtrar en memoria', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.findOneForRequester(11, userAbonado10),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({
      where: { idAbonado: 11, idUsuario: 10 },
    });
  });

  it('findOwn consulta por idUsuario de sesión, no por ids de cliente', async () => {
    findOne.mockResolvedValue(abonado10);

    const result = await service.findOwn(userAbonado10);

    expect(findOne).toHaveBeenCalledWith({ where: { idUsuario: 10 } });
    expect(result.idAbonado).toBe(10);
  });

  it('Administradora puede consultar abonado 11', async () => {
    findOne.mockResolvedValue(abonado11);

    await expect(service.findOneForRequester(11, adminUser)).resolves.toEqual(
      abonado11,
    );
    expect(findOne).toHaveBeenCalledWith({ where: { idAbonado: 11 } });
  });

  it('Administradora recibe 404 si el abonado no existe', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.findOneForRequester(123, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sesión sin idUsuario numérico no autoriza', async () => {
    await expect(
      service.findOwn({
        ...userAbonado10,
        userId: 'demo-user-id',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOne).not.toHaveBeenCalled();
  });
});
