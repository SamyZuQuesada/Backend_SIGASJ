import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { crearPermisosTestApp } from './testing/permisos-colaborador.test-app';

const VAC = '/api/v1/rrhh/vacaciones';
const INC = '/api/v1/rrhh/incapacidades';

describe('Políticas RRHH ASADA', () => {
  let app: INestApplication<App>;
  let signAs: (role: Role) => string;
  let crearColaborador: Awaited<
    ReturnType<typeof crearPermisosTestApp>
  >['crearColaborador'];
  let crearUsuario: Awaited<
    ReturnType<typeof crearPermisosTestApp>
  >['crearUsuario'];
  let movimientoRepo: Repository<MovimientoVacaciones>;
  let jwtService: JwtService;
  let adminToken: string;

  const signAsUsuario = (role: Role, idUsuario: number) => {
    const payload: JwtPayload = {
      sub: idUsuario,
      email: `${role.toLowerCase()}@asadasanjuan.cr`,
      role,
      name: `Usuario ${role}`,
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const ctx = await crearPermisosTestApp();
    app = ctx.app;
    signAs = ctx.signAs;
    crearColaborador = ctx.crearColaborador;
    crearUsuario = ctx.crearUsuario;
    adminToken = signAs(Role.ADMINISTRADORA);
    movimientoRepo = app.get(getRepositoryToken(MovimientoVacaciones));
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('AJUSTE +/− afecta saldo; motivo y responsable requeridos', async () => {
    const colab = await crearColaborador({ cedula: '1-3000-0001' });
    await request(app.getHttpServer())
      .post(`${VAC}/movimientos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        colaboradorId: colab.id,
        tipo: TipoMovimientoVacaciones.ACUMULADO,
        cantidadDias: 10,
        fecha: '2026-01-01',
      })
      .expect(201);

    const sinMotivo = await request(app.getHttpServer())
      .post(`${VAC}/movimientos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        colaboradorId: colab.id,
        tipo: TipoMovimientoVacaciones.AJUSTE,
        cantidadDias: 2,
        signoAjuste: 1,
        fecha: '2026-01-02',
      });
    expect(sinMotivo.status).toBe(400);

    await request(app.getHttpServer())
      .post(`${VAC}/movimientos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        colaboradorId: colab.id,
        tipo: TipoMovimientoVacaciones.AJUSTE,
        cantidadDias: 2,
        signoAjuste: 1,
        fecha: '2026-01-02',
        observaciones: 'Corrección administrativa',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${VAC}/movimientos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        colaboradorId: colab.id,
        tipo: TipoMovimientoVacaciones.AJUSTE,
        cantidadDias: 3,
        signoAjuste: -1,
        fecha: '2026-01-03',
        observaciones: 'Ajuste a la baja',
      })
      .expect(201);

    const balance = await request(app.getHttpServer())
      .get(`${VAC}/colaboradores/${colab.id}/balance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(balance.body).toMatchObject({
      diasAcumulados: 10,
      diasAjusteNeto: -1,
      diasDisponibles: 9,
    });

    const ajustes = await movimientoRepo.find({
      where: { colaboradorId: colab.id, tipo: TipoMovimientoVacaciones.AJUSTE },
    });
    expect(ajustes).toHaveLength(2);
    expect(ajustes.every((m) => m.registradoPorUsuarioId === 1)).toBe(true);
  });

  it('SECRETARIA 200 en RRHH; FONTANERO 403 admin y 200 en saldo propio', async () => {
    const usuario = await crearUsuario('font.mias@asadasanjuan.cr');
    const colab = await crearColaborador({
      cedula: '1-3000-0002',
      usuarioId: usuario.idUsuario,
    });

    await request(app.getHttpServer())
      .get(`${VAC}/colaboradores/${colab.id}/balance`)
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`${VAC}/colaboradores/${colab.id}/balance`)
      .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`${VAC}/mias/balance`)
      .set(
        'Authorization',
        `Bearer ${signAsUsuario(Role.FONTANERO, usuario.idUsuario)}`,
      )
      .expect(200)
      .expect((res) => {
        expect(res.body.colaboradorId).toBe(colab.id);
      });

    await request(app.getHttpServer())
      .get(`${VAC}/mias/balance`)
      .set('Authorization', `Bearer ${signAsUsuario(Role.FONTANERO, 999999)}`)
      .expect(403);
  });

  it('incapacidad con/sin origen', async () => {
    const colab = await crearColaborador({ cedula: '1-3000-0003' });
    const sinOrigen = await request(app.getHttpServer())
      .post(INC)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        colaboradorId: colab.id,
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
      })
      .expect(201);
    expect(sinOrigen.body.origen).toBeNull();

    const conOrigen = await request(app.getHttpServer())
      .post(INC)
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
      .send({
        colaboradorId: colab.id,
        fechaInicio: '2026-04-01',
        fechaFin: '2026-04-03',
        origen: 'CCSS',
      })
      .expect(201);
    expect(conOrigen.body.origen).toBe('CCSS');
  });
});
