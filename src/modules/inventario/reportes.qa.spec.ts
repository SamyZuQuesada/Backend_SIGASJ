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

const reportesQaTypeOrmModule = TypeOrmModule.forRoot({
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

describe('3.12 Reportes de inventario', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let categoriaRepository: Repository<CategoriaMaterial>;
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

  const adminGetReporte = (query = '', token?: string) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/admin/inventario/reportes/resumen${query}`,
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
        reportesQaTypeOrmModule,
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
    categoriaRepository = moduleRef.get(getRepositoryToken(CategoriaMaterial));
    movimientoRepository = moduleRef.get(getRepositoryToken(MovimientoInventario));
    usuarioRepository = moduleRef.get(getRepositoryToken(Usuario));

    const roles = await seedRolesBase(moduleRef.get(getRepositoryToken(Rol)));
    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Reportes',
      correo: 'admin.reportes@asada.test',
      role: Role.ADMINISTRADORA,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
    await materialRepository.clear();
    await categoriaRepository.clear();
  });

  it('devuelve indicadores consolidados del inventario', async () => {
    const categoria = await categoriaRepository.save(
      categoriaRepository.create({ nombre: 'Tuberías', activo: true }),
    );

    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC',
        unidadMedida: 'Metro',
        stockActual: 3,
        stockMinimo: 5,
        activo: true,
        idCategoria: categoria.id,
      }),
    );

    await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.ENTRADA,
        cantidad: 10,
        fechaMovimiento: new Date('2026-08-10T10:00:00.000Z'),
        idMaterial: material.id,
        idUsuario: administradora.idUsuario,
      }),
    );

    await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.SALIDA,
        cantidad: 2,
        fechaMovimiento: new Date('2026-08-12T11:00:00.000Z'),
        idMaterial: material.id,
        idUsuario: administradora.idUsuario,
      }),
    );

    const res = await adminGetReporte('', signAs(Role.ADMINISTRADORA));

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.indicadores.totalMateriales).toBe(1);
    expect(res.body.indicadores.materialesActivos).toBe(1);
    expect(res.body.indicadores.materialesStockBajo).toBe(1);
    expect(res.body.indicadores.entradasRegistradas).toBe(1);
    expect(res.body.indicadores.salidasRegistradas).toBe(1);
    expect(res.body.movimientos).toHaveLength(2);
  });

  it('filtra movimientos por periodo, material, categoría y tipo', async () => {
    const categoria = await categoriaRepository.save(
      categoriaRepository.create({ nombre: 'Accesorios', activo: true }),
    );

    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Unión PVC',
        unidadMedida: 'Unidad',
        stockActual: 10,
        stockMinimo: 2,
        activo: true,
        idCategoria: categoria.id,
      }),
    );

    await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.ENTRADA,
        cantidad: 5,
        fechaMovimiento: new Date('2026-08-05T08:00:00.000Z'),
        idMaterial: material.id,
        idUsuario: administradora.idUsuario,
      }),
    );

    await movimientoRepository.save(
      movimientoRepository.create({
        tipo: TipoMovimientoInventario.SALIDA,
        cantidad: 1,
        fechaMovimiento: new Date('2026-08-20T08:00:00.000Z'),
        idMaterial: material.id,
        idUsuario: administradora.idUsuario,
      }),
    );

    const res = await adminGetReporte(
      `?fechaDesde=2026-08-01&fechaHasta=2026-08-15&idMaterial=${material.id}&idCategoria=${categoria.id}&tipo=ENTRADA`,
      signAs(Role.ADMINISTRADORA),
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.indicadores.entradasRegistradas).toBe(1);
    expect(res.body.indicadores.salidasRegistradas).toBe(0);
    expect(res.body.movimientos).toHaveLength(1);
    expect(res.body.movimientos[0].tipo).toBe(TipoMovimientoInventario.ENTRADA);
  });

  it('rechaza consultas sin autenticación o con rol no autorizado', async () => {
    await adminGetReporte('').expect(HttpStatus.UNAUTHORIZED);
    await adminGetReporte('', signAs(Role.FONTANERO)).expect(HttpStatus.FORBIDDEN);
  });

  it('rechaza rangos de fechas inválidos', async () => {
    await adminGetReporte(
      '?fechaDesde=2026-09-12&fechaHasta=2026-09-01',
      signAs(Role.ADMINISTRADORA),
    ).expect(HttpStatus.BAD_REQUEST);
  });
});
