import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Colaborador } from './entities/colaborador.entity';
import {
  COLABORADORES_URL as URL,
  crearColaboradoresTestApp,
} from './testing/colaboradores.test-app';

describe('POST /api/v1/rrhh/colaboradores', () => {
  let app: INestApplication<App>;
  let colaboradorRepository: Repository<Colaborador>;
  let adminToken: string;
  let signAs: (role: Role) => string;
  let crearUsuario: Awaited<
    ReturnType<typeof crearColaboradoresTestApp>
  >['crearUsuario'];

  const body = (extra: Record<string, unknown> = {}) => ({
    nombre: 'Carlos',
    apellidos: 'Pérez Mora',
    cedula: '1-1234-0567',
    correoElectronico: 'carlos.perez@asadasanjuan.cr',
    cargo: 'Fontanero',
    ...extra,
  });

  const post = (data: Record<string, unknown>, token = adminToken) =>
    request(app.getHttpServer())
      .post(URL)
      .set('Authorization', `Bearer ${token}`)
      .send(data);

  const colaboradorDe = (res: request.Response) => res.body as Colaborador;

  beforeAll(async () => {
    const ctx = await crearColaboradoresTestApp();
    ({ app, colaboradorRepository, signAs, crearUsuario } = ctx);
    adminToken = signAs(Role.ADMINISTRADORA);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await colaboradorRepository.clear();
  });

  describe('Autenticación y permisos', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).post(URL).send(body());
      expect(res.status).toBe(401);
    });

    it('rechaza token inválido (401)', async () => {
      const res = await post(body(), 'token_invalido');
      expect(res.status).toBe(401);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403)',
      async (role) => {
        const res = await post(body(), signAs(role));
        expect(res.status).toBe(403);
        expect(await colaboradorRepository.count()).toBe(0);
      },
    );
  });

  describe('Registro válido', () => {
    it('registra un colaborador activo y lo almacena', async () => {
      const res = await post(
        body({
          nombre: '  Carlos ',
          correoElectronico: ' Carlos.Perez@ASADASANJUAN.CR ',
        }),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        correoElectronico: 'carlos.perez@asadasanjuan.cr',
        cargo: 'Fontanero',
        activo: true,
        usuarioId: null,
      });

      const guardado = await colaboradorRepository.findOneBy({
        id: colaboradorDe(res).id,
      });
      expect(guardado?.activo).toBe(true);
      expect(guardado?.createdAt).toBeInstanceOf(Date);
    });

    it('no permite enviar "activo": el registro siempre inicia activo (400)', async () => {
      const res = await post(body({ activo: false }));
      expect(res.status).toBe(400);
    });

    it('registra personal administrativo', async () => {
      const res = await post(
        body({ cedula: '2-0456-0789', cargo: 'Administradora' }),
      );
      expect(res.status).toBe(201);
      expect(colaboradorDe(res).cargo).toBe('Administradora');
    });

    it('normaliza la cédula nacional sin guiones', async () => {
      const res = await post(body({ cedula: '112340567' }));
      expect(res.status).toBe(201);
      expect(colaboradorDe(res).cedula).toBe('1-1234-0567');
    });

    it('acepta DIMEX', async () => {
      const res = await post(body({ cedula: '155812345678' }));
      expect(res.status).toBe(201);
      expect(colaboradorDe(res).cedula).toBe('155812345678');
    });

    it('relaciona una cuenta de usuario existente', async () => {
      const usuario = await crearUsuario('fontanero1@asadasanjuan.cr');
      const res = await post(body({ usuarioId: usuario.idUsuario }));

      expect(res.status).toBe(201);
      expect(colaboradorDe(res).usuarioId).toBe(usuario.idUsuario);
    });
  });

  describe('Datos inválidos', () => {
    it.each(['nombre', 'apellidos', 'cedula', 'correoElectronico', 'cargo'])(
      'rechaza si falta %s (400)',
      async (campo) => {
        const data = body();
        delete (data as Record<string, unknown>)[campo];
        const res = await post(data);
        expect(res.status).toBe(400);
      },
    );

    it('rechaza campos vacíos o solo espacios (400)', async () => {
      const res = await post(body({ nombre: '   ', cargo: '' }));
      expect(res.status).toBe(400);
    });

    it('rechaza correo con formato inválido (400)', async () => {
      const res = await post(body({ correoElectronico: 'no-es-correo' }));
      expect(res.status).toBe(400);
    });

    it.each(['0-1234-5678', '1-123-4567', 'ABC123', '12345'])(
      'rechaza cédula inválida "%s" (400)',
      async (cedula) => {
        const res = await post(body({ cedula }));
        expect(res.status).toBe(400);
      },
    );

    it('rechaza textos que exceden la longitud máxima (400)', async () => {
      const res = await post(body({ cargo: 'x'.repeat(101) }));
      expect(res.status).toBe(400);
    });

    it('rechaza campos no permitidos (400)', async () => {
      const res = await post(body({ rol: 'ADMINISTRADORA' }));
      expect(res.status).toBe(400);
    });

    it('rechaza usuarioId inexistente (400)', async () => {
      const res = await post(body({ usuarioId: 99999 }));
      expect(res.status).toBe(400);
      expect(await colaboradorRepository.count()).toBe(0);
    });

    it('rechaza usuarioId no numérico (400)', async () => {
      const res = await post(body({ usuarioId: 'abc' }));
      expect(res.status).toBe(400);
    });
  });

  describe('Conflictos', () => {
    it('rechaza cédula duplicada, aunque venga sin guiones (409)', async () => {
      expect((await post(body())).status).toBe(201);

      const res = await post(
        body({ cedula: '112340567', correoElectronico: 'otro@test.cr' }),
      );
      expect(res.status).toBe(409);
      expect(await colaboradorRepository.count()).toBe(1);
    });

    it('rechaza una cuenta de usuario ya asignada a otro colaborador (409)', async () => {
      const usuario = await crearUsuario('fontanero2@asadasanjuan.cr');
      expect((await post(body({ usuarioId: usuario.idUsuario }))).status).toBe(
        201,
      );

      const res = await post(
        body({ cedula: '3-0111-0222', usuarioId: usuario.idUsuario }),
      );
      expect(res.status).toBe(409);
    });
  });
});
