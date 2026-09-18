import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Repository } from 'typeorm';
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

const movimientosQaTypeOrmModule = TypeOrmModule.forRoot({
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

describe('3.11 Historial de movimientos de inventario', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let movimientoRepository: Repository<MovimientoInventario>;
  let usuarioRepository: Repository<Usuario>;
  let rolRepository: Repository<Rol>;
  let administradora: Usuario;
  let fontanero: Usuario;

  const signAs = (role: Role | string, sub?: string) => {
    const payload: JwtPayload = {
      sub: sub ?? String(administradora?.idUsuario ?? 1),
      email: `${String(role).toLowerCase()}@asada.test`,
      role: role as Role,
      name: `Usuario ${String(role)}`,
    };
    return jwtService.sign(payload);
  };

  const adminGetMovimientos = (query = '', token?: string) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/admin/inventario/movimientos${query}`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const adminGetMovimiento = (id: number, token?: string) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/admin/inventario/movimientos/${id}`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        movimientosQaTypeOrmModule,
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
    movimientoRepository = moduleRef.get(getRepositoryToken(MovimientoInventario));
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));
    rolRepository = moduleRef.get(getRepositoryToken(Rol));

    const roles = await seedRolesBase(rolRepository);
    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Movimientos',
      correo: 'admin.movimientos@asada.test',
      role: Role.ADMINISTRADORA,
    });
    fontanero = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Fontanero Movimientos',
      correo: 'fontanero.movimientos@asada.test',
      role: Role.FONTANERO,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
    await materialRepository.clear();
  });

  it('lista movimientos paginados con material, responsable y referencia', async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC',
        unidadMedida: 'Metro',
        stockActual: 20,
        stockMinimo: 5,
        activo: true,
      }),
    );

    const entrada = await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.ENTRADA,
        cantidad: 30,
        fechaMovimiento: new Date('2026-08-22T14:15:00.000Z'),
        idMaterial: material.id,
        idUsuario: administradora.idUsuario,
        observacion: 'Recepción de compra',
      }),
    );

    await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.SALIDA,
        cantidad: 4,
        fechaMovimiento: new Date('2026-08-22T10:30:00.000Z'),
        idMaterial: material.id,
        idUsuario: fontanero.idUsuario,
        observacion: 'Atención de avería',
      }),
    );

    const res = await adminGetMovimientos('', signAs(Role.ADMINISTRADORA));

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe(entrada.id);
    expect(res.body.data[0].material.nombre).toBe('Tubo PVC');
    expect(res.body.data[0].usuario.nombre).toBeTruthy();
    expect(res.body.data[1].tipo).toBe(TipoMovimientoInventario.SALIDA);
    expect(res.body.data[1].referencia).toBeNull();
  });

  it('filtra por tipo, material y rango de fechas', async () => {
    const materialA = await materialRepository.save(
      materialRepository.create({
        nombre: 'Unión PVC',
        unidadMedida: 'Unidad',
        stockActual: 10,
        stockMinimo: 2,
        activo: true,
      }),
    );
    const materialB = await materialRepository.save(
      materialRepository.create({
        nombre: 'Codo PVC',
        unidadMedida: 'Unidad',
        stockActual: 8,
        stockMinimo: 2,
        activo: true,
      }),
    );

    await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.SALIDA,
        cantidad: 5,
        fechaMovimiento: new Date('2026-08-21T08:00:00.000Z'),
        idMaterial: materialA.id,
        idUsuario: fontanero.idUsuario,
      }),
    );
    await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.ENTRADA,
        cantidad: 10,
        fechaMovimiento: new Date('2026-08-23T12:00:00.000Z'),
        idMaterial: materialB.id,
        idUsuario: administradora.idUsuario,
      }),
    );

    const res = await adminGetMovimientos(
      `?tipo=ENTRADA&idMaterial=${materialB.id}&fechaDesde=2026-08-22&fechaHasta=2026-08-24`,
      signAs(Role.ADMINISTRADORA),
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].tipo).toBe(TipoMovimientoInventario.ENTRADA);
    expect(res.body.data[0].material.nombre).toBe('Codo PVC');
  });

  it('consulta el detalle de un movimiento existente', async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC',
        unidadMedida: 'Metro',
        stockActual: 15,
        stockMinimo: 5,
        activo: true,
      }),
    );

    const movimiento = await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.ENTRADA,
        cantidad: 20,
        fechaMovimiento: new Date('2026-08-22T14:20:00.000Z'),
        idMaterial: material.id,
        idUsuario: administradora.idUsuario,
        observacion: 'Compra directa',
      }),
    );

    const res = await adminGetMovimiento(movimiento.id, signAs(Role.ADMINISTRADORA));

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.id).toBe(movimiento.id);
    expect(res.body.material.unidadMedida).toBe('Metro');
    expect(res.body.usuario.id).toBe(administradora.idUsuario);
    expect(res.body.observacion).toBe('Compra directa');
  });

  it('rechaza consultas sin autenticación o con rol no autorizado', async () => {
    await adminGetMovimientos('').expect(HttpStatus.UNAUTHORIZED);
    await adminGetMovimientos('', signAs(Role.FONTANERO)).expect(HttpStatus.FORBIDDEN);
  });

  it('devuelve 404 para un movimiento inexistente', async () => {
    await adminGetMovimiento(99999, signAs(Role.ADMINISTRADORA)).expect(
      HttpStatus.NOT_FOUND,
    );
  });

  it('rechaza rangos de fechas inválidos', async () => {
    await adminGetMovimientos(
      '?fechaDesde=2026-09-12&fechaHasta=2026-09-01',
      signAs(Role.ADMINISTRADORA),
    ).expect(HttpStatus.BAD_REQUEST);
  });
});
