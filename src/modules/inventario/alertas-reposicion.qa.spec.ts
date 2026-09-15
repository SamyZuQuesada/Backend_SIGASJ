import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoAlertaReposicion } from '../../common/enums/estado-alerta-reposicion.enum';
import { EstadoReposicionMaterial } from '../../common/enums/estado-reposicion-material.enum';
import { OrigenReposicionMaterial } from '../../common/enums/origen-reposicion-material.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Averia } from '../averias/entities/averia.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { AlertaReposicion } from './entities/alerta-reposicion.entity';
import { ReposicionMaterial } from './entities/reposicion-material.entity';
import { DetalleReposicionMaterial } from './entities/detalle-reposicion-material.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { InventarioModule } from './inventario.module';

const alertasQaTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [
    Usuario,
    Rol,
    Material,
    CategoriaMaterial,
    Proveedor,
    MovimientoInventario,
    DocumentoMovimientoInventario,
    SolicitudMaterial,
    DetalleSolicitudMaterial,
    AlertaReposicion,
    ReposicionMaterial,
    DetalleReposicionMaterial,
    Averia,
  ],
  synchronize: true,
});

describe('3.8.3 Consulta administrativa de alertas de reposición', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let alertaRepository: Repository<AlertaReposicion>;
  let usuarioRepository: Repository<Usuario>;
  let administradora: Usuario;

  const signAs = (role: Role | string, sub?: string) => {
    const payload: JwtPayload = {
      sub: sub ?? String(administradora?.idUsuario ?? 1),
      email: `${String(role).toLowerCase()}@asada.test`,
      role: role as Role,
      name: `Usuario ${String(role)}`,
    };
    return jwtService.sign(payload);
  };

  const adminGet = (query = '', token?: string) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/admin/inventario/alertas-reposicion${query}`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        alertasQaTypeOrmModule,
        TypeOrmModule.forFeature([Usuario, Rol]),
        AuthModule,
        InventarioModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = moduleRef.get(JwtService);
    materialRepository = moduleRef.get(getRepositoryToken(Material));
    alertaRepository = moduleRef.get(getRepositoryToken(AlertaReposicion));
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));
    const rolRepository = moduleRef.get<Repository<Rol>>(getRepositoryToken(Rol));
    const roles = await seedRolesBase(rolRepository);

    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Alertas',
      correo: 'admin.alertas@asada.test',
      role: Role.ADMINISTRADORA,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await alertaRepository.clear();
    await materialRepository.clear();
  });

  it('rechaza con 401 si no hay sesión', async () => {
    await adminGet().expect(HttpStatus.UNAUTHORIZED);
  });

  it('rechaza con 403 si el rol no es Administradora', async () => {
    await adminGet('', signAs(Role.FONTANERO, '7')).expect(HttpStatus.FORBIDDEN);
    await adminGet('', signAs(Role.SECRETARIA, '2')).expect(
      HttpStatus.FORBIDDEN,
    );
  });

  it('retorna lista vacía paginada cuando no hay alertas', async () => {
    const res = await adminGet(
      '',
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.OK);

    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(res.body.totalPages).toBe(0);
  });

  it('lista alertas con material, unidad, stock, estado, fecha y responsable opcional', async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC 1/2"',
        unidadMedida: 'Metro',
        stockActual: 4,
        stockMinimo: 10,
        activo: true,
      }),
    );

    const sinResponsable = await alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 4,
        stockMinimo: 10,
        estado: EstadoAlertaReposicion.PENDIENTE,
        fechaGeneracion: new Date('2026-09-10T10:00:00Z'),
        idUsuarioGestiona: null,
      }),
    );

    const conResponsable = await alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 2,
        stockMinimo: 10,
        estado: EstadoAlertaReposicion.EN_GESTION,
        fechaGeneracion: new Date('2026-09-12T10:00:00Z'),
        idUsuarioGestiona: administradora.idUsuario,
      }),
    );

    const res = await adminGet(
      '',
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.OK);

    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe(conResponsable.id);
    expect(res.body.data[0].material.nombre).toBe('Tubo PVC 1/2"');
    expect(res.body.data[0].material.unidadMedida).toBe('Metro');
    expect(res.body.data[0].stockActual).toBe(2);
    expect(res.body.data[0].stockMinimo).toBe(10);
    expect(res.body.data[0].estado).toBe(EstadoAlertaReposicion.EN_GESTION);
    expect(res.body.data[0].fechaGeneracion).toBeDefined();
    expect(res.body.data[0].updatedAt).toBeDefined();
    expect(res.body.data[0].usuarioGestiona).toEqual({
      id: administradora.idUsuario,
      nombre: 'Administradora Alertas',
    });
    expect(res.body.data[0]).not.toHaveProperty('passwordHash');

    const pendiente = res.body.data.find(
      (item: { id: number }) => item.id === sinResponsable.id,
    );
    expect(pendiente.usuarioGestiona).toBeNull();
    expect(pendiente.estado).toBe(EstadoAlertaReposicion.PENDIENTE);
  });

  it('filtra por estado y pagina de más reciente a más antigua', async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Unión PVC',
        unidadMedida: 'Unidad',
        stockActual: 1,
        stockMinimo: 5,
        activo: true,
      }),
    );

    const pendiente = await alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 3,
        stockMinimo: 5,
        estado: EstadoAlertaReposicion.PENDIENTE,
        fechaGeneracion: new Date('2026-09-01T10:00:00Z'),
      }),
    );
    const reciente = await alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 1,
        stockMinimo: 5,
        estado: EstadoAlertaReposicion.PENDIENTE,
        fechaGeneracion: new Date('2026-09-14T10:00:00Z'),
      }),
    );
    await alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 0,
        stockMinimo: 5,
        estado: EstadoAlertaReposicion.RESUELTA,
        fechaGeneracion: new Date('2026-09-15T10:00:00Z'),
      }),
    );

    const filtrado = await adminGet(
      '?estado=Pendiente',
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.OK);

    expect(filtrado.body.total).toBe(2);
    expect(
      filtrado.body.data.every(
        (item: { estado: string }) =>
          item.estado === EstadoAlertaReposicion.PENDIENTE,
      ),
    ).toBe(true);

    const pagina1 = await adminGet(
      '?estado=PENDIENTE&page=1&limit=1',
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.OK);

    expect(pagina1.body.total).toBe(2);
    expect(pagina1.body.totalPages).toBe(2);
    expect(pagina1.body.data[0].id).toBe(reciente.id);

    const pagina2 = await adminGet(
      '?estado=PENDIENTE&page=2&limit=1',
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.OK);
    expect(pagina2.body.data[0].id).toBe(pendiente.id);
  });

  it('acepta el alias textual En gestión y rechaza estados inválidos', async () => {
    const token = signAs(Role.ADMINISTRADORA, String(administradora.idUsuario));

    await adminGet('?estado=En%20gesti%C3%B3n', token).expect(HttpStatus.OK);
    await adminGet('?estado=hola', token).expect(HttpStatus.BAD_REQUEST);
    await adminGet('?page=0', token).expect(HttpStatus.BAD_REQUEST);
    await adminGet('?limit=abc', token).expect(HttpStatus.BAD_REQUEST);
  });

  it('también responde en los alias /inventario/alertas-reposicion y /admin/alertas-reposicion', async () => {
    const token = signAs(Role.ADMINISTRADORA, String(administradora.idUsuario));

    await request(app.getHttpServer())
      .get('/api/v1/inventario/alertas-reposicion')
      .set('Authorization', `Bearer ${token}`)
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .get('/api/v1/admin/alertas-reposicion')
      .set('Authorization', `Bearer ${token}`)
      .expect(HttpStatus.OK);
  });
});

describe('3.8.6 Cambio de estado de alertas de reposición', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let alertaRepository: Repository<AlertaReposicion>;
  let usuarioRepository: Repository<Usuario>;
  let administradora: Usuario;

  const signAs = (role: Role | string, sub?: string) => {
    const payload: JwtPayload = {
      sub: sub ?? String(administradora?.idUsuario ?? 1),
      email: `${String(role).toLowerCase()}@asada.test`,
      role: role as Role,
      name: `Usuario ${String(role)}`,
    };
    return jwtService.sign(payload);
  };

  const adminPatch = (id: number, body: Record<string, unknown>, token?: string) => {
    const req = request(app.getHttpServer()).patch(
      `/api/v1/admin/inventario/alertas-reposicion/${id}/estado`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        alertasQaTypeOrmModule,
        TypeOrmModule.forFeature([Usuario, Rol]),
        AuthModule,
        InventarioModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = moduleRef.get(JwtService);
    materialRepository = moduleRef.get(getRepositoryToken(Material));
    alertaRepository = moduleRef.get(getRepositoryToken(AlertaReposicion));
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));
    const rolRepository = moduleRef.get<Repository<Rol>>(getRepositoryToken(Rol));
    const roles = await seedRolesBase(rolRepository);

    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Alertas Estado',
      correo: 'admin.alertas.estado@asada.test',
      role: Role.ADMINISTRADORA,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await alertaRepository.clear();
    await materialRepository.clear();
  });

  const crearAlertaPendiente = async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Codo PVC',
        unidadMedida: 'Unidad',
        stockActual: 2,
        stockMinimo: 5,
        activo: true,
      }),
    );
    return alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 2,
        stockMinimo: 5,
        estado: EstadoAlertaReposicion.PENDIENTE,
        fechaGeneracion: new Date('2026-09-14T10:00:00Z'),
        idUsuarioGestiona: null,
      }),
    );
  };

  it('rechaza con 401 si no hay sesión y con 403 si el rol no es Administradora', async () => {
    await adminPatch(1, { estado: 'EN_GESTION' }).expect(HttpStatus.UNAUTHORIZED);
    await adminPatch(1, { estado: 'EN_GESTION' }, signAs(Role.FONTANERO, '7')).expect(
      HttpStatus.FORBIDDEN,
    );
  });

  it('retorna 404 si la alerta no existe', async () => {
    await adminPatch(
      999,
      { estado: 'EN_GESTION' },
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.NOT_FOUND);
  });

  it('pasa de Pendiente a En gestión y luego a Resuelta, registrando responsable', async () => {
    const alerta = await crearAlertaPendiente();
    const token = signAs(Role.ADMINISTRADORA, String(administradora.idUsuario));

    const enGestion = await adminPatch(
      alerta.id,
      { estado: 'En gestión' },
      token,
    ).expect(HttpStatus.OK);

    expect(enGestion.body.estado).toBe(EstadoAlertaReposicion.EN_GESTION);
    expect(enGestion.body.idUsuarioGestiona).toBe(administradora.idUsuario);
    expect(enGestion.body.usuarioGestiona).toEqual({
      id: administradora.idUsuario,
      nombre: 'Administradora Alertas Estado',
    });
    expect(enGestion.body.updatedAt).toBeDefined();

    const persistida = await alertaRepository.findOneBy({ id: alerta.id });
    expect(persistida?.estado).toBe(EstadoAlertaReposicion.EN_GESTION);

    const resuelta = await adminPatch(
      alerta.id,
      { estado: 'RESUELTA' },
      token,
    ).expect(HttpStatus.OK);
    expect(resuelta.body.estado).toBe(EstadoAlertaReposicion.RESUELTA);
  });

  it('rechaza transiciones inválidas y estados no reconocidos', async () => {
    const alerta = await crearAlertaPendiente();
    const token = signAs(Role.ADMINISTRADORA, String(administradora.idUsuario));

    await adminPatch(alerta.id, { estado: 'RESUELTA' }, token).expect(
      HttpStatus.BAD_REQUEST,
    );
    await adminPatch(alerta.id, { estado: 'ATENDIDA' }, token).expect(
      HttpStatus.BAD_REQUEST,
    );
  });
});

describe('3.9.2 Generar reposición desde alerta de stock mínimo', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let alertaRepository: Repository<AlertaReposicion>;
  let reposicionRepository: Repository<ReposicionMaterial>;
  let detalleReposicionRepository: Repository<DetalleReposicionMaterial>;
  let usuarioRepository: Repository<Usuario>;
  let administradora: Usuario;

  const signAs = (role: Role | string, sub?: string) => {
    const payload: JwtPayload = {
      sub: sub ?? String(administradora?.idUsuario ?? 1),
      email: `${String(role).toLowerCase()}@asada.test`,
      role: role as Role,
      name: `Usuario ${String(role)}`,
    };
    return jwtService.sign(payload);
  };

  const adminPost = (
    id: number,
    body: Record<string, unknown> = {},
    token?: string,
  ) => {
    const req = request(app.getHttpServer()).post(
      `/api/v1/admin/inventario/alertas-reposicion/${id}/reposicion`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        alertasQaTypeOrmModule,
        TypeOrmModule.forFeature([Usuario, Rol]),
        AuthModule,
        InventarioModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = moduleRef.get(JwtService);
    materialRepository = moduleRef.get(getRepositoryToken(Material));
    alertaRepository = moduleRef.get(getRepositoryToken(AlertaReposicion));
    reposicionRepository = moduleRef.get(getRepositoryToken(ReposicionMaterial));
    detalleReposicionRepository = moduleRef.get(
      getRepositoryToken(DetalleReposicionMaterial),
    );
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));
    const rolRepository = moduleRef.get<Repository<Rol>>(getRepositoryToken(Rol));
    const roles = await seedRolesBase(rolRepository);

    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Reposición Alerta',
      correo: 'admin.reposicion.alerta@asada.test',
      role: Role.ADMINISTRADORA,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await detalleReposicionRepository.clear();
    await reposicionRepository.clear();
    await alertaRepository.clear();
    await materialRepository.clear();
  });

  const crearAlertaPendiente = async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Válvula 1/2"',
        unidadMedida: 'Unidad',
        stockActual: 2,
        stockMinimo: 8,
        activo: true,
      }),
    );
    const alerta = await alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 2,
        stockMinimo: 8,
        estado: EstadoAlertaReposicion.PENDIENTE,
        fechaGeneracion: new Date('2026-09-14T10:00:00Z'),
        idUsuarioGestiona: null,
      }),
    );
    return { material, alerta };
  };

  it('rechaza con 401 si no hay sesión y con 403 si el rol no es Administradora', async () => {
    await adminPost(1).expect(HttpStatus.UNAUTHORIZED);
    await adminPost(1, {}, signAs(Role.FONTANERO, '7')).expect(
      HttpStatus.FORBIDDEN,
    );
  });

  it('retorna 404 si la alerta no existe', async () => {
    await adminPost(
      999,
      {},
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.NOT_FOUND);
  });

  it('genera reposición desde alerta válida sin modificar stock', async () => {
    const { material, alerta } = await crearAlertaPendiente();
    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const res = await adminPost(alerta.id, {}, token).expect(HttpStatus.CREATED);

    expect(res.body.codigo).toMatch(/^REP-\d{4}$/);
    expect(res.body.origen).toBe(OrigenReposicionMaterial.ALERTA_STOCK_MINIMO);
    expect(res.body.estado).toBe(EstadoReposicionMaterial.PENDIENTE);
    expect(res.body.idAlertaReposicion).toBe(alerta.id);
    expect(res.body.idUsuarioResponsable).toBe(administradora.idUsuario);
    expect(res.body.detalles).toHaveLength(1);
    expect(res.body.detalles[0]).toMatchObject({
      idMaterial: material.id,
      cantidad: 6,
    });

    const materialDespues = await materialRepository.findOneBy({
      id: material.id,
    });
    expect(materialDespues?.stockActual).toBe(2);

    const persistida = await reposicionRepository.findOne({
      where: { id: res.body.id },
      relations: { detalles: true },
    });
    expect(persistida?.idAlertaReposicion).toBe(alerta.id);
    expect(persistida?.detalles[0].cantidad).toBe(6);
  });

  it('acepta cantidad explícita y rechaza alerta resuelta o duplicada', async () => {
    const { alerta } = await crearAlertaPendiente();
    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const primera = await adminPost(
      alerta.id,
      { cantidad: 20, observacion: 'Compra programada' },
      token,
    ).expect(HttpStatus.CREATED);
    expect(primera.body.detalles[0].cantidad).toBe(20);
    expect(primera.body.observacion).toBe('Compra programada');

    await adminPost(alerta.id, { cantidad: 5 }, token).expect(
      HttpStatus.CONFLICT,
    );

    alerta.estado = EstadoAlertaReposicion.RESUELTA;
    await alertaRepository.save(alerta);

    const { alerta: otra } = await crearAlertaPendiente();
    otra.estado = EstadoAlertaReposicion.RESUELTA;
    await alertaRepository.save(otra);
    await adminPost(otra.id, {}, token).expect(HttpStatus.BAD_REQUEST);
  });
});
