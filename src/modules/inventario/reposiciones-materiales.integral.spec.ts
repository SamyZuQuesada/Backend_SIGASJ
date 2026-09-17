import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoAlertaReposicion } from '../../common/enums/estado-alerta-reposicion.enum';
import { EstadoReposicionMaterial } from '../../common/enums/estado-reposicion-material.enum';
import { OrigenReposicionMaterial } from '../../common/enums/origen-reposicion-material.enum';
import { Role } from '../../common/enums/role.enum';
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

const integralTypeOrmModule = TypeOrmModule.forRoot({
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

describe('Backlog 3.9: Reposición y compra de materiales — Pruebas integrales', () => {
  jest.setTimeout(30_000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let proveedorRepository: Repository<Proveedor>;
  let alertaRepository: Repository<AlertaReposicion>;
  let reposicionRepository: Repository<ReposicionMaterial>;
  let movimientoRepository: Repository<MovimientoInventario>;
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

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        integralTypeOrmModule,
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
    alertaRepository = moduleRef.get(getRepositoryToken(AlertaReposicion));
    reposicionRepository = moduleRef.get(getRepositoryToken(ReposicionMaterial));
    movimientoRepository = moduleRef.get(getRepositoryToken(MovimientoInventario));
    const usuarioRepository = moduleRef.get<Repository<Usuario>>(
      getRepositoryToken(Usuario),
    );
    const rolRepository = moduleRef.get<Repository<Rol>>(getRepositoryToken(Rol));
    const roles = await seedRolesBase(rolRepository);

    administradora = await crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Administradora Integral Reposiciones',
      correo: 'admin.reposiciones.integral@asada.test',
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
    await reposicionRepository.clear();
    await alertaRepository.clear();
    await materialRepository.clear();
    await proveedorRepository.clear();
  });

  it('recorre alerta → reposición → gestión → compra → recepción → completada sin alterar stock hasta integrar entradas', async () => {
    const material = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC Integral',
        unidadMedida: 'Metro',
        stockActual: 8,
        stockMinimo: 20,
        activo: true,
      }),
    );
    const proveedor = await proveedorRepository.save(
      proveedorRepository.create({ nombre: 'Ferretería Integral', activo: true }),
    );
    const alerta = await alertaRepository.save(
      alertaRepository.create({
        idMaterial: material.id,
        stockActual: 8,
        stockMinimo: 20,
        estado: EstadoAlertaReposicion.PENDIENTE,
        fechaGeneracion: new Date('2026-09-10T10:00:00Z'),
        idUsuarioGestiona: null,
      }),
    );

    const token = signAs(
      Role.ADMINISTRADORA,
      String(administradora.idUsuario),
    );

    const reposicionRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/inventario/alertas-reposicion/${alerta.id}/reposicion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cantidad: 12 })
      .expect(HttpStatus.CREATED);

    expect(reposicionRes.body.origen).toBe(
      OrigenReposicionMaterial.ALERTA_STOCK_MINIMO,
    );
    expect(reposicionRes.body.estado).toBe(EstadoReposicionMaterial.PENDIENTE);
    expect(reposicionRes.body.idAlertaReposicion).toBe(alerta.id);

    const reposicionId = reposicionRes.body.id as number;
    const stockTrasReposicion = await materialRepository.findOneBy({
      id: material.id,
    });
    expect(stockTrasReposicion?.stockActual).toBe(8);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventario/alertas-reposicion/${alerta.id}/reposicion`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(HttpStatus.CONFLICT);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/inventario/reposiciones/${reposicionId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: EstadoReposicionMaterial.EN_GESTION })
      .expect(HttpStatus.OK);

    const compraRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/inventario/reposiciones/${reposicionId}/compra`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        idProveedor: proveedor.id,
        fechaCompra: '2026-09-12T00:00:00.000Z',
        referenciaCompra: 'FAC-INT-001',
        detalles: [{ idMaterial: material.id, cantidad: 50 }],
      })
      .expect(HttpStatus.OK);

    expect(compraRes.body.estado).toBe(
      EstadoReposicionMaterial.PENDIENTE_RECEPCION,
    );
    expect(compraRes.body.idProveedor).toBe(proveedor.id);

    const stockTrasCompra = await materialRepository.findOneBy({
      id: material.id,
    });
    expect(stockTrasCompra?.stockActual).toBe(8);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventario/reposiciones/${reposicionId}/compra`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        idProveedor: proveedor.id,
        fechaCompra: '2026-09-13T00:00:00.000Z',
        detalles: [{ idMaterial: material.id, cantidad: 10 }],
      })
      .expect(HttpStatus.CONFLICT);

    const recepcionRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/inventario/reposiciones/${reposicionId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: EstadoReposicionMaterial.RECIBIDA })
      .expect(HttpStatus.OK);

    expect(recepcionRes.body.estado).toBe(EstadoReposicionMaterial.RECIBIDA);
    expect(recepcionRes.body.fechaRecepcion).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/inventario/reposiciones/${reposicionId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: EstadoReposicionMaterial.RECIBIDA })
      .expect(HttpStatus.BAD_REQUEST);

    const completadaRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/inventario/reposiciones/${reposicionId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: EstadoReposicionMaterial.COMPLETADA })
      .expect(HttpStatus.OK);

    expect(completadaRes.body.estado).toBe(EstadoReposicionMaterial.COMPLETADA);

    const listado = await request(app.getHttpServer())
      .get('/api/v1/admin/inventario/reposiciones')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 10 })
      .expect(HttpStatus.OK);

    expect(listado.body.total).toBeGreaterThanOrEqual(1);
    expect(listado.body.data[0].codigo).toBeDefined();
  });

  it('rechaza operaciones sin sesión o con rol no autorizado', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/inventario/reposiciones')
      .expect(HttpStatus.UNAUTHORIZED);

    await request(app.getHttpServer())
      .get('/api/v1/admin/inventario/reposiciones')
      .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '9')}`)
      .expect(HttpStatus.FORBIDDEN);
  });
});
