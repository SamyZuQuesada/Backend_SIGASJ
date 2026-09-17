import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
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

const reposicionesQaTypeOrmModule = TypeOrmModule.forRoot({
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

describe('3.9.3 Registrar compra de reposición de materiales', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let proveedorRepository: Repository<Proveedor>;
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

  const adminPostCompra = (
    id: number,
    body: Record<string, unknown>,
    token?: string,
  ) => {
    const req = request(app.getHttpServer()).post(
      `/api/v1/admin/inventario/reposiciones/${id}/compra`,
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
        reposicionesQaTypeOrmModule,
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
    proveedorRepository = moduleRef.get(getRepositoryToken(Proveedor));
    reposicionRepository = moduleRef.get(getRepositoryToken(ReposicionMaterial));
    detalleReposicionRepository = moduleRef.get(
      getRepositoryToken(DetalleReposicionMaterial),
    );
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));
    const rolRepository = moduleRef.get<Repository<Rol>>(getRepositoryToken(Rol));
    const roles = await seedRolesBase(rolRepository);

    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Compra Reposición',
      correo: 'admin.compra.reposicion@asada.test',
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
    await materialRepository.clear();
    await proveedorRepository.clear();
  });

  const crearReposicionPendiente = async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC 1/2"',
        unidadMedida: 'Metro',
        stockActual: 2,
        stockMinimo: 8,
        activo: true,
      }),
    );

    const proveedor = await proveedorRepository.save(
      proveedorRepository.create({
        nombre: 'Ferretería ABC',
        activo: true,
      }),
    );

    const reposicion = await reposicionRepository.save(
      reposicionRepository.create({
        codigo: 'REP-0012',
        fechaGeneracion: new Date('2026-09-14T10:00:00Z'),
        origen: OrigenReposicionMaterial.ALERTA_STOCK_MINIMO,
        estado: EstadoReposicionMaterial.PENDIENTE,
        idUsuarioResponsable: administradora.idUsuario,
        idAlertaReposicion: null,
        detalles: [
          detalleReposicionRepository.create({
            idMaterial: material.id,
            cantidad: 6,
          }),
        ],
      }),
    );

    return { material, proveedor, reposicion };
  };

  it('rechaza con 401 si no hay sesión y con 403 si el rol no es Administradora', async () => {
    await adminPostCompra(1, {
      idProveedor: 1,
      fechaCompra: '2026-08-25T00:00:00.000Z',
      detalles: [{ idMaterial: 1, cantidad: 10 }],
    }).expect(HttpStatus.UNAUTHORIZED);

    await adminPostCompra(
      1,
      {
        idProveedor: 1,
        fechaCompra: '2026-08-25T00:00:00.000Z',
        detalles: [{ idMaterial: 1, cantidad: 10 }],
      },
      signAs(Role.FONTANERO, '7'),
    ).expect(HttpStatus.FORBIDDEN);
  });

  it('retorna 404 si la reposición no existe', async () => {
    const { proveedor } = await crearReposicionPendiente();

    await adminPostCompra(
      999,
      {
        idProveedor: proveedor.id,
        fechaCompra: '2026-08-25T00:00:00.000Z',
        detalles: [{ idMaterial: 1, cantidad: 10 }],
      },
      signAs(Role.ADMINISTRADORA, String(administradora.idUsuario)),
    ).expect(HttpStatus.NOT_FOUND);
  });

  it('registra compra en reposición válida sin modificar stock', async () => {
    const { material, proveedor, reposicion } = await crearReposicionPendiente();
    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const res = await adminPostCompra(
      reposicion.id,
      {
        idProveedor: proveedor.id,
        fechaCompra: '2026-08-25T00:00:00.000Z',
        referenciaCompra: 'FAC-2026-0045',
        observacion: 'Compra programada',
        detalles: [{ idMaterial: material.id, cantidad: 30 }],
      },
      token,
    ).expect(HttpStatus.OK);

    expect(res.body.estado).toBe(EstadoReposicionMaterial.COMPRA_REGISTRADA);
    expect(res.body.idProveedor).toBe(proveedor.id);
    expect(res.body.proveedor).toEqual({
      id: proveedor.id,
      nombre: 'Ferretería ABC',
    });
    expect(res.body.fechaCompra).toBeDefined();
    expect(res.body.observacion).toContain('Referencia: FAC-2026-0045');
    expect(res.body.detalles[0]).toMatchObject({
      idMaterial: material.id,
      cantidad: 30,
    });

    const materialDespues = await materialRepository.findOneBy({
      id: material.id,
    });
    expect(materialDespues?.stockActual).toBe(2);

    const persistida = await reposicionRepository.findOne({
      where: { id: reposicion.id },
      relations: { detalles: true, proveedor: true },
    });
    expect(persistida?.estado).toBe(EstadoReposicionMaterial.COMPRA_REGISTRADA);
    expect(persistida?.idProveedor).toBe(proveedor.id);
    expect(persistida?.detalles[0].cantidad).toBe(30);
  });

  it('rechaza proveedor inactivo, compra duplicada y materiales incompletos', async () => {
    const { material, proveedor, reposicion } = await crearReposicionPendiente();
    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const proveedorInactivo = await proveedorRepository.save(
      proveedorRepository.create({
        nombre: 'Proveedor Inactivo',
        activo: false,
      }),
    );

    await adminPostCompra(
      reposicion.id,
      {
        idProveedor: proveedorInactivo.id,
        fechaCompra: '2026-08-25T00:00:00.000Z',
        detalles: [{ idMaterial: material.id, cantidad: 10 }],
      },
      token,
    ).expect(HttpStatus.BAD_REQUEST);

    await adminPostCompra(
      reposicion.id,
      {
        idProveedor: proveedor.id,
        fechaCompra: '2026-08-25T00:00:00.000Z',
        detalles: [{ idMaterial: material.id, cantidad: 30 }],
      },
      token,
    ).expect(HttpStatus.OK);

    await adminPostCompra(
      reposicion.id,
      {
        idProveedor: proveedor.id,
        fechaCompra: '2026-08-26T00:00:00.000Z',
        detalles: [{ idMaterial: material.id, cantidad: 5 }],
      },
      token,
    ).expect(HttpStatus.CONFLICT);

    const otra = await crearReposicionPendiente();
    await adminPostCompra(
      otra.reposicion.id,
      {
        idProveedor: otra.proveedor.id,
        fechaCompra: '2026-08-25T00:00:00.000Z',
        detalles: [],
      },
      token,
    ).expect(HttpStatus.BAD_REQUEST);
  });
});

describe('3.9.4 Consulta administrativa de reposiciones', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let proveedorRepository: Repository<Proveedor>;
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

  const adminGet = (path = '', token?: string) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/admin/inventario/reposiciones${path}`,
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
        reposicionesQaTypeOrmModule,
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
    proveedorRepository = moduleRef.get(getRepositoryToken(Proveedor));
    reposicionRepository = moduleRef.get(getRepositoryToken(ReposicionMaterial));
    detalleReposicionRepository = moduleRef.get(
      getRepositoryToken(DetalleReposicionMaterial),
    );
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));
    const rolRepository = moduleRef.get<Repository<Rol>>(getRepositoryToken(Rol));
    const roles = await seedRolesBase(rolRepository);

    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Reposiciones Listado',
      correo: 'admin.reposiciones.listado@asada.test',
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
    await materialRepository.clear();
    await proveedorRepository.clear();
  });

  it('lista reposiciones paginadas con materiales, origen y estado', async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Unión PVC',
        unidadMedida: 'Unidad',
        stockActual: 1,
        stockMinimo: 5,
        activo: true,
      }),
    );

    await reposicionRepository.save(
      reposicionRepository.create({
        codigo: 'REP-0013',
        fechaGeneracion: new Date('2026-09-15T10:00:00Z'),
        origen: OrigenReposicionMaterial.ALERTA_STOCK_MINIMO,
        estado: EstadoReposicionMaterial.PENDIENTE,
        idUsuarioResponsable: administradora.idUsuario,
        detalles: [
          detalleReposicionRepository.create({
            idMaterial: material.id,
            cantidad: 4,
          }),
        ],
      }),
    );

    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const res = await adminGet('', token).expect(HttpStatus.OK);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      codigo: 'REP-0013',
      origen: OrigenReposicionMaterial.ALERTA_STOCK_MINIMO,
      estado: EstadoReposicionMaterial.PENDIENTE,
    });
    expect(res.body.data[0].detalles[0]).toMatchObject({
      idMaterial: material.id,
      cantidad: 4,
      material: { nombre: 'Unión PVC' },
    });
  });

  it('retorna detalle de una reposición y 404 si no existe', async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Codo PVC',
        unidadMedida: 'Unidad',
        stockActual: 2,
        stockMinimo: 6,
        activo: true,
      }),
    );

    const reposicion = await reposicionRepository.save(
      reposicionRepository.create({
        codigo: 'REP-0020',
        fechaGeneracion: new Date('2026-09-16T10:00:00Z'),
        origen: OrigenReposicionMaterial.ADMINISTRATIVA,
        estado: EstadoReposicionMaterial.EN_GESTION,
        idUsuarioResponsable: administradora.idUsuario,
        detalles: [
          detalleReposicionRepository.create({
            idMaterial: material.id,
            cantidad: 8,
          }),
        ],
      }),
    );

    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const detalle = await adminGet(`/${reposicion.id}`, token).expect(
      HttpStatus.OK,
    );
    expect(detalle.body.codigo).toBe('REP-0020');
    expect(detalle.body.detalles).toHaveLength(1);

    await adminGet('/999', token).expect(HttpStatus.NOT_FOUND);
  });
});
