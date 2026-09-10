import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { MAX_ACTIVIDAD_DOCUMENT_BYTES } from '../../common/media/public-media';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import {
  buildValidCreateActividadPayload,
  seedTiposActividadFontanero,
} from './testing/actividades-fontanero.test-helpers';
import { ACTIVIDADES_MSG } from './actividades-fontanero.messages';
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { EstadoActividadFontanero } from '../../common/enums/estado-actividad-fontanero.enum';

describe('HTTP documentos — tamaño y adjunto (actividades fontanero)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tipos: Repository<TipoActividadFontanero>;
  let documentos: Repository<DocumentoActividadFontanero>;
  let tipoId: number;
  let actividadId: number;

  const signFontanero = (sub = 'fontanero-docs-1') => {
    const payload: JwtPayload = {
      sub,
      email: 'fontanero-docs@asadasanjuan.cr',
      role: Role.FONTANERO,
      name: 'Fontanero Docs',
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [
            ActividadFontanero,
            TipoActividadFontanero,
            DocumentoActividadFontanero,
            Usuario,
          ],
          synchronize: true,
        }),
        AuthModule,
        ActividadesFontaneroModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    jwtService = moduleFixture.get(JwtService);
    actividades = moduleFixture.get(getRepositoryToken(ActividadFontanero));
    documentos = moduleFixture.get(
      getRepositoryToken(DocumentoActividadFontanero),
    );
    tipos = moduleFixture.get(getRepositoryToken(TipoActividadFontanero));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await documentos.clear();
    await actividades.clear();
    await tipos.clear();
    await seedTiposActividadFontanero(tipos);
    const tipo = await tipos.findOneByOrFail({
      codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    });
    tipoId = tipo.id;

    const created = await request(app.getHttpServer())
      .post('/api/v1/fontanero/actividades')
      .set('Authorization', `Bearer ${signFontanero()}`)
      .send(buildValidCreateActividadPayload(tipoId))
      .expect(201);

    actividadId = (created.body as { id: number }).id;
  });

  it('POST documentos con archivo válido responde 201', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/fontanero/actividades/${actividadId}/documentos`)
      .set('Authorization', `Bearer ${signFontanero()}`)
      .attach('archivo', Buffer.from('%PDF-1.7 evidencia'), {
        filename: 'evidencia.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        actividadId,
        nombreOriginal: 'evidencia.pdf',
        tipoArchivo: 'application/pdf',
      }),
    );
    expect(response.body).not.toHaveProperty('success');
    expect(JSON.stringify(response.body)).not.toMatch(
      /QueryFailedError|TypeORM|stack/i,
    );
  });

  it('rechaza archivo > 10 MB con 400 y mensaje seguro', async () => {
    const oversized = Buffer.alloc(MAX_ACTIVIDAD_DOCUMENT_BYTES + 1);
    oversized.write('%PDF-1.7');

    const response = await request(app.getHttpServer())
      .post(`/api/v1/fontanero/actividades/${actividadId}/documentos`)
      .set('Authorization', `Bearer ${signFontanero()}`)
      .attach('archivo', oversized, {
        filename: 'grande.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: ACTIVIDADES_MSG.documentoDemasiadoGrande,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /MulterError|LIMIT_FILE_SIZE|File too large|stack|TypeORM/i,
    );
  });

  it('sin archivo responde 400 controlado', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/fontanero/actividades/${actividadId}/documentos`)
      .set('Authorization', `Bearer ${signFontanero()}`)
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(String(response.body.message)).toContain('adjuntar');
  });

  it('actividad inexistente responde 404', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/fontanero/actividades/999999/documentos')
      .set('Authorization', `Bearer ${signFontanero()}`)
      .attach('archivo', Buffer.from('%PDF-1.7 x'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      message: ACTIVIDADES_MSG.actividadNotFound,
    });
  });

  it('actividad ajena responde 403', async () => {
    const actividad = await actividades.findOneByOrFail({ id: actividadId });
    actividad.fontaneroId = 'otro-fontanero';
    actividad.estado = EstadoActividadFontanero.REPORTADA;
    await actividades.save(actividad);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/fontanero/actividades/${actividadId}/documentos`)
      .set('Authorization', `Bearer ${signFontanero()}`)
      .attach('archivo', Buffer.from('%PDF-1.7 x'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);

    expect(response.body).toEqual({
      statusCode: 403,
      message: ACTIVIDADES_MSG.forbidden,
    });
  });
});
