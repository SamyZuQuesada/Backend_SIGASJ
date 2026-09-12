import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Repository } from 'typeorm';
import jwtConfig from '../../config/jwt.config';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { Averia } from '../averias/entities/averia.entity';
import { InventarioModule } from './inventario.module';

const documentosQaTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [
    Usuario,
    Material,
    CategoriaMaterial,
    Proveedor,
    MovimientoInventario,
    DocumentoMovimientoInventario,
    SolicitudMaterial,
    DetalleSolicitudMaterial,
    Averia,
  ],
  synchronize: true,
});

describe('Documentos de Respaldo en Entradas de Inventario — QA Integral y Validación Funcional', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepo: Repository<Material>;
  let usuarioRepo: Repository<Usuario>;
  let movimientoRepo: Repository<MovimientoInventario>;
  let documentoRepo: Repository<DocumentoMovimientoInventario>;

  let testMaterial: Material;
  let testMovimiento: MovimientoInventario;

  const signAs = (role: Role | string, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: `${String(role).toLowerCase()}@asada.test`,
      role: role as Role,
      name: 'Tester Documentos ASADA',
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        documentosQaTypeOrmModule,
        TypeOrmModule.forFeature([Usuario]),
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

    jwtService = moduleRef.get<JwtService>(JwtService);
    materialRepo = moduleRef.get<Repository<Material>>(
      getRepositoryToken(Material),
    );
    usuarioRepo = moduleRef.get<Repository<Usuario>>(
      getRepositoryToken(Usuario),
    );
    movimientoRepo = moduleRef.get<Repository<MovimientoInventario>>(
      getRepositoryToken(MovimientoInventario),
    );
    documentoRepo = moduleRef.get<Repository<DocumentoMovimientoInventario>>(
      getRepositoryToken(DocumentoMovimientoInventario),
    );

    // Sembrar usuario Administradora
    const adminUser = usuarioRepo.create({
      idUsuario: 1,
    });
    await usuarioRepo.save(adminUser);

    // Sembrar material base
    testMaterial = materialRepo.create({
      nombre: 'Tubo PVC 1/2 Presión RDE-13.5',
      descripcion: 'Tubo de fontanería para acometidas',
      unidadMedida: 'Tubo',
      ubicacion: 'Estante C-1',
      stockActual: 20,
      stockMinimo: 5,
      activo: true,
    });
    testMaterial = await materialRepo.save(testMaterial);

    // Sembrar movimiento de entrada inicial
    testMovimiento = movimientoRepo.create({
      tipo: TipoMovimientoInventario.ENTRADA,
      cantidad: 15,
      fechaMovimiento: new Date(),
      observacion: 'Entrada por factura #F-9901 de Ferretería Central',
      idMaterial: testMaterial.id,
      idUsuario: 1,
    });
    testMovimiento = await movimientoRepo.save(testMovimiento);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Subida de Documentos de Respaldo (POST /api/v1/inventario/movimientos/:id/documentos y alias /entradas/:id/documentos)', () => {
    let savedPdfFilename: string;

    it('adjunta exitosamente una factura en PDF a una entrada con rol ADMINISTRADORA (201 Created)', async () => {
      // Magic bytes de PDF (%PDF-1.4)
      const pdfBuffer = Buffer.from('%PDF-1.4 factura de prueba de materiales');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', pdfBuffer, {
          filename: 'factura_compra_9901.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.nombreOriginal).toBe('factura_compra_9901.pdf');
      expect(response.body.tipoArchivo).toBe('application/pdf');
      expect(response.body.tamanio).toBe(pdfBuffer.length);
      expect(response.body.idMovimiento).toBe(testMovimiento.id);
      expect(response.body.rutaReferenciaArchivo).toContain(
        `/api/v1/inventario/movimientos/${testMovimiento.id}/documentos/`,
      );

      // Extraer nombre de archivo guardado para pruebas posteriores
      const parts = response.body.rutaReferenciaArchivo.split('/');
      savedPdfFilename = parts[parts.length - 1];
      expect(savedPdfFilename.endsWith('.pdf')).toBe(true);
    });

    it('adjunta exitosamente una imagen comprobante JPG a través del alias /entradas/:id/documentos (201 Created)', async () => {
      // Magic bytes de JPEG (\xFF\xD8\xFF)
      const jpgBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
      ]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/entradas/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', jpgBuffer, {
          filename: 'recibo_entrega.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.nombreOriginal).toBe('recibo_entrega.jpg');
      expect(response.body.tipoArchivo).toBe('image/jpeg');
      expect(response.body.idMovimiento).toBe(testMovimiento.id);
    });

    it('adjunta exitosamente un comprobante PNG con firma binaria válida (201 Created)', async () => {
      // Magic bytes de PNG (\x89PNG\r\n\x1a\n)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', pngBuffer, {
          filename: 'guia_remision.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body.nombreOriginal).toBe('guia_remision.png');
      expect(response.body.tipoArchivo).toBe('image/png');
    });

    it('adjunta exitosamente un comprobante WebP con firma válida RIFF...WEBP (201 Created)', async () => {
      // Cabecera WebP: "RIFF" (4 bytes) + 4 bytes length + "WEBP" (4 bytes)
      const webpHeader = Buffer.from('RIFF1234WEBP');
      const webpBuffer = Buffer.concat([
        webpHeader,
        Buffer.from('image_payload'),
      ]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', webpBuffer, {
          filename: 'comprobante_bancario.webp',
          contentType: 'image/webp',
        })
        .expect(201);

      expect(response.body.nombreOriginal).toBe('comprobante_bancario.webp');
      expect(response.body.tipoArchivo).toBe('image/webp');
    });

    it('confirma que los documentos quedan vinculados al movimiento y no modifican las existencias del material', async () => {
      const materialConsultado = await materialRepo.findOne({
        where: { id: testMaterial.id },
      });

      // El stock original era 20, la entrada fue de 15 pero ya estaba reflejada en la BD
      expect(materialConsultado?.stockActual).toBe(testMaterial.stockActual);
    });
  });

  describe('2. Rechazo de Formatos Inválidos, Firmas Falsas y Límite de Tamaño', () => {
    it('rechaza subir archivos con formato no permitido (.exe, .txt) con 400 Bad Request', async () => {
      const txtBuffer = Buffer.from('Esto es un archivo de texto no permitido');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', txtBuffer, {
          filename: 'script_malicioso.exe',
          contentType: 'application/octet-stream',
        })
        .expect(400);

      expect(response.body.message).toContain(
        'Solo se permiten archivos PDF, JPG, PNG o WebP',
      );
    });

    it('rechaza archivos cuya extensión dice .pdf pero su cabecera no coincide (magic numbers falsos) con 400 Bad Request', async () => {
      const fakePdf = Buffer.from('Texto falso simulando ser un PDF');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', fakePdf, {
          filename: 'factura_falsa.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      expect(response.body.message).toContain(
        'El contenido del archivo no coincide con su formato declarado',
      );
    });

    it('rechaza archivos que superen los 10 MB con 400 Bad Request', async () => {
      // 10 MB + 1 byte
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
      oversized.write('%PDF-1.4');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', oversized, {
          filename: 'documento_gigante.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      expect(response.body.message).toContain('10 MB');
    });

    it('rechaza peticiones sin archivo con 400 Bad Request', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(400);

      expect(response.body.message).toContain(
        'Debe adjuntar un archivo de respaldo',
      );
    });

    it('retorna 404 Not Found si se intenta adjuntar a un movimiento inexistente', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 dummy');

      await request(app.getHttpServer())
        .post('/api/v1/inventario/movimientos/99999/documentos')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', pdfBuffer, {
          filename: 'factura.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });
  });

  describe('3. Consulta y Listado de Documentos Adjuntos (GET /movimientos/:id/documentos y /entradas/:id/documentos)', () => {
    it('permite a ADMINISTRADORA listar los documentos adjuntos de un movimiento (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(4);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('nombreOriginal');
      expect(response.body[0]).toHaveProperty('tipoArchivo');
      expect(response.body[0]).toHaveProperty('rutaReferenciaArchivo');
      expect(response.body[0]).toHaveProperty('tamanio');
    });

    it('permite consultar mediante la ruta alias /entradas/:id/documentos (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventario/entradas/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(4);
    });

    it('permite a SECRETARIA y FONTANERO consultar los documentos de respaldo (200 OK)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/inventario/entradas/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
        .expect(200);
    });

    it('retorna 404 Not Found si se consulta un movimiento que no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inventario/movimientos/88888/documentos')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(404);
    });
  });

  describe('4. Descarga y Visualización de Archivos Segura (GET /movimientos/:id/documentos/:filename)', () => {
    let filenameToDownload: string;

    beforeAll(async () => {
      const docs = await documentoRepo.find({
        where: { idMovimiento: testMovimiento.id },
      });
      const parts = docs[0].rutaReferenciaArchivo.split('/');
      filenameToDownload = parts[parts.length - 1];
    });

    it('descarga o transmite el archivo adjunto correctamente (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventario/movimientos/${testMovimiento.id}/documentos/${filenameToDownload}`,
        )
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.headers['content-type']).toBeDefined();
    });

    it('permite la descarga a través del alias /entradas/:id/documentos/:filename (200 OK)', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/inventario/entradas/${testMovimiento.id}/documentos/${filenameToDownload}`,
        )
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);
    });

    it('previene ataques de Path Traversal (..) con 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/inventario/movimientos/${testMovimiento.id}/documentos/..%2f..%2fetc%2fpasswd`,
        )
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(400);
    });

    it('retorna 404 Not Found si el archivo solicitado no existe', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/inventario/movimientos/${testMovimiento.id}/documentos/archivo_no_existente.pdf`,
        )
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(404);
    });
  });

  describe('5. Seguridad y Control de Acceso por Roles (RBAC)', () => {
    it('rechaza con 401 Unauthorized las solicitudes sin token', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test');
      await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .attach('archivo', pdfBuffer, {
          filename: 'factura.pdf',
          contentType: 'application/pdf',
        })
        .expect(401);

      await request(app.getHttpServer())
        .get(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .expect(401);
    });

    it('rechaza con 403 Forbidden cuando SECRETARIA intenta adjuntar un documento a la entrada', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test');
      await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .attach('archivo', pdfBuffer, {
          filename: 'factura.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);
    });

    it('rechaza con 403 Forbidden cuando FONTANERO intenta adjuntar un documento a la entrada', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test');
      await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
        .attach('archivo', pdfBuffer, {
          filename: 'factura.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);
    });

    it('rechaza con 403 Forbidden a roles de usuario final (ABONADO)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test');
      await request(app.getHttpServer())
        .post(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs('ABONADO')}`)
        .attach('archivo', pdfBuffer, {
          filename: 'factura.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);

      await request(app.getHttpServer())
        .get(`/api/v1/inventario/movimientos/${testMovimiento.id}/documentos`)
        .set('Authorization', `Bearer ${signAs('ABONADO')}`)
        .expect(403);
    });
  });
});
