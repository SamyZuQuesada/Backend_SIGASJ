import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoReposicionMaterial } from '../../common/enums/estado-reposicion-material.enum';
import { OrigenReposicionMaterial } from '../../common/enums/origen-reposicion-material.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
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
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DetalleReposicionMaterial } from './entities/detalle-reposicion-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { ReposicionMaterial } from './entities/reposicion-material.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { InventarioModule } from './inventario.module';

const recepcionesQaTypeOrmModule = TypeOrmModule.forRoot({
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

describe('3.10 Recepción y actualización de inventario', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let proveedorRepository: Repository<Proveedor>;
  let reposicionRepository: Repository<ReposicionMaterial>;
  let detalleReposicionRepository: Repository<DetalleReposicionMaterial>;
  let movimientoRepository: Repository<MovimientoInventario>;
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

  const adminPostRecepcion = (body: Record<string, unknown>, token?: string) => {
    const req = request(app.getHttpServer()).post(
      '/api/v1/admin/inventario/recepciones',
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        recepcionesQaTypeOrmModule,
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
    movimientoRepository = moduleRef.get(getRepositoryToken(MovimientoInventario));
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));
    const rolRepository = moduleRef.get<Repository<Rol>>(getRepositoryToken(Rol));
    const roles = await seedRolesBase(rolRepository);

    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Recepciones',
      correo: 'admin.recepciones@asada.test',
      role: Role.ADMINISTRADORA,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
    await detalleReposicionRepository.clear();
    await reposicionRepository.clear();
    await materialRepository.clear();
    await proveedorRepository.clear();
  });

  const crearReposicionPendienteRecepcion = async () => {
    const proveedor = await proveedorRepository.save(
      proveedorRepository.create({ nombre: 'Ferretería Recepción', activo: true }),
    );
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC Recepción',
        unidadMedida: 'Metro',
        stockActual: 15,
        stockMinimo: 20,
        activo: true,
      }),
    );
    const reposicion = await reposicionRepository.save(
      reposicionRepository.create({
        codigo: 'REP-0100',
        fechaGeneracion: new Date('2026-09-16T10:00:00Z'),
        origen: OrigenReposicionMaterial.ADMINISTRATIVA,
        estado: EstadoReposicionMaterial.PENDIENTE_RECEPCION,
        idUsuarioResponsable: administradora.idUsuario,
        idProveedor: proveedor.id,
        fechaCompra: new Date('2026-09-15T12:00:00Z'),
        detalles: [
          detalleReposicionRepository.create({
            idMaterial: material.id,
            cantidad: 20,
          }),
        ],
      }),
    );
    return { material, proveedor, reposicion };
  };

  it('registra recepción válida, genera ENTRADA y actualiza stock', async () => {
    const { material, reposicion } = await crearReposicionPendienteRecepcion();
    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const res = await adminPostRecepcion(
      {
        idReposicion: reposicion.id,
        detalles: [{ idMaterial: material.id, cantidad: 20 }],
        observacion: 'Recepción conforme',
      },
      token,
    ).expect(HttpStatus.OK);

    expect(res.body.estado).toBe(EstadoReposicionMaterial.RECIBIDA);
    expect(res.body.fechaRecepcion).toBeDefined();
    expect(res.body.movimientos).toHaveLength(1);
    expect(res.body.movimientos[0].tipo).toBe(TipoMovimientoInventario.ENTRADA);
    expect(res.body.movimientos[0].idReposicion).toBe(reposicion.id);

    const materialDespues = await materialRepository.findOneBy({ id: material.id });
    expect(materialDespues?.stockActual).toBe(35);

    const movimientos = await movimientoRepository.find({
      where: { idReposicion: reposicion.id },
    });
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].cantidad).toBe(20);
    expect(movimientos[0].idUsuario).toBe(administradora.idUsuario);
  });

  it('rechaza recepción duplicada, cantidades inválidas y estados no permitidos', async () => {
    const { material, reposicion } = await crearReposicionPendienteRecepcion();
    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    await adminPostRecepcion(
      {
        idReposicion: reposicion.id,
        detalles: [{ idMaterial: material.id, cantidad: 20 }],
      },
      token,
    ).expect(HttpStatus.OK);

    await adminPostRecepcion(
      {
        idReposicion: reposicion.id,
        detalles: [{ idMaterial: material.id, cantidad: 20 }],
      },
      token,
    ).expect(HttpStatus.BAD_REQUEST);

    const materialDespues = await materialRepository.findOneBy({ id: material.id });
    expect(materialDespues?.stockActual).toBe(35);

    await movimientoRepository.clear();
    await reposicionRepository.update(reposicion.id, {
      estado: EstadoReposicionMaterial.PENDIENTE,
    });

    await adminPostRecepcion(
      {
        idReposicion: reposicion.id,
        detalles: [{ idMaterial: material.id, cantidad: 20 }],
      },
      token,
    ).expect(HttpStatus.BAD_REQUEST);

    await adminPostRecepcion(
      {
        idReposicion: reposicion.id,
        detalles: [{ idMaterial: material.id, cantidad: 0 }],
      },
      token,
    ).expect(HttpStatus.BAD_REQUEST);
  });

  it('rechaza PATCH directo a RECIBIDA y exige endpoint de recepción', async () => {
    const { material, reposicion } = await crearReposicionPendienteRecepcion();
    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/inventario/reposiciones/${reposicion.id}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: EstadoReposicionMaterial.RECIBIDA })
      .expect(HttpStatus.BAD_REQUEST);

    const materialSinCambio = await materialRepository.findOneBy({
      id: material.id,
    });
    expect(materialSinCambio?.stockActual).toBe(15);
  });

  it('aplica seguridad: 401 sin sesión y 403 para fontanero', async () => {
    const { material, reposicion } = await crearReposicionPendienteRecepcion();

    await adminPostRecepcion({
      idReposicion: reposicion.id,
      detalles: [{ idMaterial: material.id, cantidad: 20 }],
    }).expect(HttpStatus.UNAUTHORIZED);

    await adminPostRecepcion(
      {
        idReposicion: reposicion.id,
        detalles: [{ idMaterial: material.id, cantidad: 20 }],
      },
      signAs(Role.FONTANERO, '99'),
    ).expect(HttpStatus.FORBIDDEN);
  });
});
