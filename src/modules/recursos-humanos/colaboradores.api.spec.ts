import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Colaborador } from './entities/colaborador.entity';
import { Puesto } from './entities/puesto.entity';
import {
  COLABORADORES_URL as URL,
  crearColaboradoresTestApp,
} from './testing/colaboradores.test-app';

describe('POST /api/v1/rrhh/colaboradores', () => {
  let app: INestApplication<App>;
  let colaboradorRepository: Repository<Colaborador>;
  let puesto: Puesto;
  let adminToken: string;
  let signAs: (role: Role) => string;
  let seedPuesto: (nombre?: string) => Promise<Puesto>;
  let crearUsuario: Awaited<
    ReturnType<typeof crearColaboradoresTestApp>
  >['crearUsuario'];

  const body = (extra: Record<string, unknown> = {}) => ({
    nombre: 'Carlos',
    apellidos: 'Pérez Mora',
    cedula: '1-1234-0567',
    correoElectronico: 'carlos.perez@asadasanjuan.cr',
    puestoId: puesto.id,
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
    ({ app, colaboradorRepository, signAs, crearUsuario, seedPuesto } = ctx);
    adminToken = signAs(Role.ADMINISTRADORA);
    puesto = await seedPuesto('Fontanero');
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

    it('permite SECRETARIA (201)', async () => {
      const res = await post(body(), signAs(Role.SECRETARIA));
      expect(res.status).toBe(201);
    });

    it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403)',
      async (role) => {
        const res = await post(body(), signAs(role));
        expect(res.status).toBe(403);
        expect(await colaboradorRepository.count()).toBe(0);
      },
    );
  });

  describe('Registro válido', () => {
    it('registra un colaborador activo y sincroniza cargo desde puesto', async () => {
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
        puestoId: puesto.id,
        activo: true,
        usuarioId: null,
      });
    });

    it('registra personal administrativo por puesto', async () => {
      const adminPuesto = await seedPuesto('Administración');
      const res = await post(
        body({ cedula: '2-0456-0789', puestoId: adminPuesto.id }),
      );
      expect(res.status).toBe(201);
      expect(colaboradorDe(res).cargo).toBe('Administración');
    });

    it('relaciona una cuenta de usuario existente', async () => {
      const usuario = await crearUsuario('fontanero1@asadasanjuan.cr');
      const res = await post(body({ usuarioId: usuario.idUsuario }));

      expect(res.status).toBe(201);
      expect(colaboradorDe(res).usuarioId).toBe(usuario.idUsuario);
    });
  });

  describe('Datos inválidos', () => {
    it.each([
      'nombre',
      'apellidos',
      'cedula',
      'correoElectronico',
      'puestoId',
    ])('rechaza si falta %s (400)', async (campo) => {
      const data = body();
      delete (data as Record<string, unknown>)[campo];
      const res = await post(data);
      expect(res.status).toBe(400);
    });

    it('rechaza puesto inexistente (400)', async () => {
      const res = await post(body({ puestoId: 99999 }));
      expect(res.status).toBe(400);
    });
  });
});
