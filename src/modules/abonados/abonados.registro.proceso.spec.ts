import { ConflictException } from '@nestjs/common';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import jwtConfig from '../../config/jwt.config';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthModule } from '../auth/auth.module';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { AbonadosController } from './abonados.controller';
import { AbonadosService } from './abonados.service';
import { Abonado } from './entities/abonado.entity';
import { SolicitudServicio } from '../solicitudes/entities/solicitud-servicio.entity';
import { Servicio } from '../servicios/entities/servicio.entity';

describe('Tarea #684 — proceso de registro de nuevos abonados', () => {
  describe('AbonadosService.register', () => {
    let service: AbonadosService;
    let abonadoExist: jest.Mock;
    let servicioExist: jest.Mock;
    let solicitudFindOne: jest.Mock;
    let transaction: jest.Mock;
    let solicitudSave: jest.Mock;

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
      solicitudSave = jest.fn().mockResolvedValue(undefined);
      solicitudFindOne = jest.fn().mockResolvedValue({
        idSolicitud: 1,
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      });

      transaction = jest.fn(async (work) => {
        const save = jest
          .fn()
          .mockResolvedValueOnce({ idUsuario: 50 })
          .mockResolvedValueOnce({ idAbonado: 12, ...dto })
          .mockResolvedValueOnce({ idServicio: 7 })
          .mockImplementation(async (entity: object) => {
            if ('utilizada' in entity) {
              return solicitudSave(entity);
            }
            return undefined;
          });

        const manager = {
          create: (_entity: unknown, payload: object) => payload,
          save,
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
            useValue: { findOne: jest.fn(), exist: abonadoExist },
          },
          {
            provide: getRepositoryToken(Servicio),
            useValue: { exist: servicioExist },
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

    it('registra abonado manual sin solicitud', async () => {
      const manualDto = { ...dto, idSolicitud: undefined };
      const result = await service.register(manualDto);

      expect(result.idAbonado).toBe(12);
      expect(solicitudSave).not.toHaveBeenCalled();
    });

    it('relaciona la solicitud aprobada con el abonado creado', async () => {
      await service.register(dto);

      expect(solicitudSave).toHaveBeenCalledWith(
        expect.objectContaining({
          idSolicitud: 1,
          utilizada: true,
          idAbonadoRegistrado: 12,
        }),
      );
    });

    it('rechaza solicitud ya utilizada sin iniciar transacción', async () => {
      solicitudFindOne.mockResolvedValue({
        idSolicitud: 1,
        estado: SolicitudEstado.APROBADA,
        utilizada: true,
      });

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(transaction).not.toHaveBeenCalled();
    });

    it('no persiste registros cuando hay cédula duplicada', async () => {
      abonadoExist.mockResolvedValueOnce(true);

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(transaction).not.toHaveBeenCalled();
    });

    it('rechaza NIS duplicado antes de registrar', async () => {
      servicioExist.mockImplementation(({ where }: { where: { nis?: string } }) =>
        Promise.resolve(Boolean(where.nis)),
      );

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(transaction).not.toHaveBeenCalled();
    });

    it('rechaza medidor duplicado antes de registrar', async () => {
      servicioExist.mockImplementation(({ where }: { where: { medidor?: string } }) =>
        Promise.resolve(Boolean(where.medidor)),
      );

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('POST /abonados — validación y permisos', () => {
    let app: INestApplication<App>;
    let jwtService: JwtService;
    let register: jest.Mock;

    const signAs = (role: Role, sub = '1') => {
      const tokenPayload: JwtPayload = {
        sub,
        email: 'usuario@asadasanjuan.cr',
        role,
        name: 'Usuario',
      };
      return jwtService.sign(tokenPayload);
    };

    beforeAll(async () => {
      register = jest.fn();

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
          AuthModule,
        ],
        controllers: [AbonadosController],
        providers: [
          { provide: AbonadosService, useValue: { register } },
          RolesGuard,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
      jwtService = moduleFixture.get(JwtService);
    });

    afterAll(async () => {
      await app.close();
    });

    it('rechaza payload incompleto con 400', async () => {
      await request(app.getHttpServer())
        .post('/abonados')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ nombre: 'María' })
        .expect(400);
    });

    it('Abonado no puede registrar nuevos abonados', async () => {
      await request(app.getHttpServer())
        .post('/abonados')
        .set('Authorization', `Bearer ${signAs(Role.ABONADO, '10')}`)
        .send({
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
        })
        .expect(403);
    });
  });
});
