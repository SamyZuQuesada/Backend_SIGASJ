import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import jwtConfig from '../../config/jwt.config';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { FormulariosDescargablesController } from './formularios-descargables.controller';
import { FormulariosDescargablesService } from './formularios-descargables.service';

describe('API admin/formularios-descargables', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const jwtSecret = 'super_secret_jwt_key_sigasj_2026';

  const mockService = {
    listarAdmin: jest.fn(),
    crear: jest.fn(),
    actualizarMetadata: jest.fn(),
    reemplazarArchivo: jest.fn(),
    cambiarEstado: jest.fn(),
  };

  const signAs = (role: Role, sub: number = 7) =>
    jwtService.sign({
      sub,
      email: `${role.toLowerCase()}@asada.cr`,
      role,
      name: role,
    });

  const sample = {
    id: 1,
    nombre: 'Formulario A',
    descripcion: 'Desc',
    nombreArchivoOriginal: 'a.pdf',
    activo: true,
    fechaPublicacion: null,
    createdAt: new Date('2026-10-25T10:00:00.000Z'),
    updatedAt: new Date('2026-10-25T10:00:00.000Z'),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [FormulariosDescargablesController],
      providers: [
        JwtStrategy,
        RolesGuard,
        {
          provide: FormulariosDescargablesService,
          useValue: mockService,
        },
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
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.listarAdmin.mockResolvedValue([sample]);
    mockService.crear.mockResolvedValue(sample);
    mockService.actualizarMetadata.mockResolvedValue({
      ...sample,
      nombre: 'Nombre B',
    });
    mockService.reemplazarArchivo.mockResolvedValue({
      ...sample,
      nombreArchivoOriginal: 'b.pdf',
    });
    mockService.cambiarEstado.mockResolvedValue({ ...sample, activo: false });
  });

  const endpoints = [
    {
      name: 'GET listar',
      call: (token?: string) => {
        const req = request(app.getHttpServer()).get(
          '/admin/formularios-descargables',
        );
        return token ? req.set('Authorization', `Bearer ${token}`) : req;
      },
    },
    {
      name: 'POST crear',
      call: (token?: string) => {
        const req = request(app.getHttpServer())
          .post('/admin/formularios-descargables')
          .field('nombre', 'Test')
          .attach('archivo', Buffer.from('%PDF-1.4\nx'), 'test.pdf');
        return token ? req.set('Authorization', `Bearer ${token}`) : req;
      },
    },
    {
      name: 'PATCH metadata',
      call: (token?: string) => {
        const req = request(app.getHttpServer())
          .patch('/admin/formularios-descargables/1')
          .send({ nombre: 'Nuevo' });
        return token ? req.set('Authorization', `Bearer ${token}`) : req;
      },
    },
    {
      name: 'PATCH archivo',
      call: (token?: string) => {
        const req = request(app.getHttpServer())
          .patch('/admin/formularios-descargables/1/archivo')
          .attach('archivo', Buffer.from('%PDF-1.4\nx'), 'test.pdf');
        return token ? req.set('Authorization', `Bearer ${token}`) : req;
      },
    },
    {
      name: 'PATCH estado',
      call: (token?: string) => {
        const req = request(app.getHttpServer())
          .patch('/admin/formularios-descargables/1/estado')
          .send({ activo: false });
        return token ? req.set('Authorization', `Bearer ${token}`) : req;
      },
    },
  ] as const;

  it.each(endpoints)('$name sin JWT → 401', async ({ call }) => {
    await call().expect(401);
    expect(mockService.listarAdmin).not.toHaveBeenCalled();
    expect(mockService.crear).not.toHaveBeenCalled();
    expect(mockService.actualizarMetadata).not.toHaveBeenCalled();
    expect(mockService.reemplazarArchivo).not.toHaveBeenCalled();
    expect(mockService.cambiarEstado).not.toHaveBeenCalled();
  });

  it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
    'rol %s → 403 en listado',
    async (role) => {
      await request(app.getHttpServer())
        .get('/admin/formularios-descargables')
        .set('Authorization', `Bearer ${signAs(role)}`)
        .expect(403);
      expect(mockService.listarAdmin).not.toHaveBeenCalled();
    },
  );

  it.each([Role.ADMINISTRADORA, Role.SECRETARIA])(
    'rol %s puede listar',
    async (role) => {
      const res = await request(app.getHttpServer())
        .get('/admin/formularios-descargables')
        .set('Authorization', `Bearer ${signAs(role)}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(mockService.listarAdmin).toHaveBeenCalled();
    },
  );

  it('edición con campos internos → 400 (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .patch('/admin/formularios-descargables/1')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
      .send({
        nombre: 'Ok',
        id: 99,
        createdAt: '2020-01-01',
        ubicacionArchivo: 'C:\\evil\\path.pdf',
        storageKey: 'hack',
        usuarioId: 999,
      })
      .expect(400);

    expect(mockService.actualizarMetadata).not.toHaveBeenCalled();
  });

  it('usuarioId en body de estado no controla el service (whitelist)', async () => {
    await request(app.getHttpServer())
      .patch('/admin/formularios-descargables/1/estado')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA, 7)}`)
      .send({ activo: false, usuarioId: 999 })
      .expect(400);

    expect(mockService.cambiarEstado).not.toHaveBeenCalled();
  });

  it('PATCH estado válido llama cambiarEstado(id, activo)', async () => {
    await request(app.getHttpServer())
      .patch('/admin/formularios-descargables/1/estado')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
      .send({ activo: false })
      .expect(200);

    expect(mockService.cambiarEstado).toHaveBeenCalledWith(1, false);
  });

  it('PATCH metadata válido', async () => {
    await request(app.getHttpServer())
      .patch('/admin/formularios-descargables/1')
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
      .send({ nombre: 'Nombre B', descripcion: 'Nueva' })
      .expect(200);

    expect(mockService.actualizarMetadata).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nombre: 'Nombre B', descripcion: 'Nueva' }),
    );
  });

  it('creación sin nombre → 400', async () => {
    await request(app.getHttpServer())
      .post('/admin/formularios-descargables')
      .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
      .field('descripcion', 'sin nombre')
      .attach('archivo', Buffer.from('%PDF-1.4\nx'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(mockService.crear).not.toHaveBeenCalled();
  });
});
