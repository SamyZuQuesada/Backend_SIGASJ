import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Asociado } from './entities/asociado.entity';
import {
  ASOCIADOS_URL as URL,
  crearAsociadosTestApp,
} from './testing/asociados.test-app';

describe('PATCH /api/v1/asociados/:id y /api/asociados/:id (Modificación de Asociados)', () => {
  let app: INestApplication<App>;
  let asociadoRepository: Repository<Asociado>;
  let signAs: (role: Role) => string;

  let adminToken: string;
  let secretariaToken: string;
  let fontaneroToken: string;
  let abonadoToken: string;

  let asociado1: Asociado;
  let asociado2: Asociado;

  const patch = (path: string, body: any, token = adminToken) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    ({ app, asociadoRepository, signAs } = await crearAsociadosTestApp());

    adminToken = signAs(Role.ADMINISTRADORA);
    secretariaToken = signAs(Role.SECRETARIA);
    fontaneroToken = signAs(Role.FONTANERO);
    abonadoToken = signAs(Role.ABONADO);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await asociadoRepository.clear();

    asociado1 = await asociadoRepository.save(
      asociadoRepository.create({
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        correoElectronico: 'carlos.perez@test.cr',
        activo: true,
        fechaRegistro: new Date('2026-01-01T10:00:00.000Z'),
        fechaInactivacion: null,
      }),
    );

    asociado2 = await asociadoRepository.save(
      asociadoRepository.create({
        nombre: 'Ana',
        apellidos: 'Solís Vega',
        cedula: '2-0456-0789',
        correoElectronico: 'ana.solis@test.cr',
        activo: true,
        fechaRegistro: new Date('2026-02-01T10:00:00.000Z'),
        fechaInactivacion: null,
      }),
    );
  });

  describe('Control de Acceso y Permisos', () => {
    it('debe rechazar con 401 si no se envía token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${URL}/${asociado1.id}`)
        .send({ nombre: 'Nuevo Nombre' });

      expect(res.status).toBe(401);
    });

    it('debe rechazar con 403 a usuarios con rol FONTANERO', async () => {
      const res = await patch(
        `${URL}/${asociado1.id}`,
        { nombre: 'Nuevo Nombre' },
        fontaneroToken,
      );

      expect(res.status).toBe(403);
    });

    it('debe rechazar con 403 a usuarios con rol ABONADO', async () => {
      const res = await patch(
        `${URL}/${asociado1.id}`,
        { nombre: 'Nuevo Nombre' },
        abonadoToken,
      );

      expect(res.status).toBe(403);
    });

    it('debe permitir la modificación a usuario con rol ADMINISTRADORA', async () => {
      const res = await patch(
        `${URL}/${asociado1.id}`,
        { nombre: 'Carlos Editado' },
        adminToken,
      );

      expect(res.status).toBe(200);
      expect(res.body.nombre).toBe('Carlos Editado');
    });

    it('debe permitir la modificación a usuario con rol SECRETARIA', async () => {
      const res = await patch(
        `${URL}/${asociado1.id}`,
        { nombre: 'Carlos Por Secretaria' },
        secretariaToken,
      );

      expect(res.status).toBe(200);
      expect(res.body.nombre).toBe('Carlos Por Secretaria');
    });
  });

  describe('Validación de ID y Manejo de 404', () => {
    it.each(['abc', '1.5', 'true'])(
      'debe rechazar con 400 si el id no es entero (%s)',
      async (invalidoId) => {
        const res = await patch(`${URL}/${invalidoId}`, {
          nombre: 'Otro Nombre',
        });
        expect(res.status).toBe(400);
      },
    );

    it('debe responder con 404 si el asociado no existe', async () => {
      const res = await patch(`${URL}/99999`, { nombre: 'Nombre X' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('No existe un asociado con id 99999');
    });
  });

  describe('Validación de Campos y DTO', () => {
    it('debe rechazar con 400 si se envía un cuerpo vacío {}', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        'Debe enviar al menos un campo para actualizar',
      );
    });

    it('debe rechazar con 400 campos no permitidos en el DTO (ej. activo, fechaRegistro)', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        activo: false,
      });
      expect(res.status).toBe(400);
    });

    it('debe rechazar con 400 si el correo no tiene un formato válido', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        correo: 'correo-invalido',
      });
      expect(res.status).toBe(400);
    });

    it('debe rechazar con 400 si el nombre es una cadena vacía o sólo espacios', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        nombre: '   ',
      });
      expect(res.status).toBe(400);
    });

    it('debe rechazar con 400 si los apellidos están vacíos', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        apellidos: '   ',
      });
      expect(res.status).toBe(400);
    });

    it('debe rechazar con 400 si la cédula está vacía', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        cedula: '   ',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Actualización Exitosa de Información', () => {
    it('debe modificar nombre y apellidos y mantener los demás campos', async () => {
      const totalAntes = await asociadoRepository.count();

      const res = await patch(`${URL}/${asociado1.id}`, {
        nombre: '  Juan Carlos  ',
        apellidos: '  Pérez Mora  ',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: asociado1.id,
        nombre: 'Juan Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        correoElectronico: 'carlos.perez@test.cr',
        activo: true,
      });

      // No se crea un nuevo asociado
      const totalDespues = await asociadoRepository.count();
      expect(totalDespues).toBe(totalAntes);
    });

    it('debe modificar correo utilizando el alias "correo"', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        correo: '  JUAN.CARLOS@NUEVO.CR  ',
      });

      expect(res.status).toBe(200);
      expect(res.body.correoElectronico).toBe('juan.carlos@nuevo.cr');

      const actualizado = await asociadoRepository.findOneBy({
        id: asociado1.id,
      });
      expect(actualizado?.correoElectronico).toBe('juan.carlos@nuevo.cr');
    });

    it('debe modificar correo utilizando "correoElectronico"', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        correoElectronico: '  carlos.contacto@empresa.cr  ',
      });

      expect(res.status).toBe(200);
      expect(res.body.correoElectronico).toBe('carlos.contacto@empresa.cr');
    });

    it('debe permitir modificar la cédula si la nueva es única', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        cedula: '  1-9999-8888  ',
      });

      expect(res.status).toBe(200);
      expect(res.body.cedula).toBe('1-9999-8888');

      const actualizado = await asociadoRepository.findOneBy({
        id: asociado1.id,
      });
      expect(actualizado?.cedula).toBe('1-9999-8888');
    });

    it('debe permitir enviar la misma cédula que ya tiene el asociado sin conflicto', async () => {
      const res = await patch(`${URL}/${asociado1.id}`, {
        cedula: '1-1234-0567',
        nombre: 'Carlos Renombrado',
      });

      expect(res.status).toBe(200);
      expect(res.body.cedula).toBe('1-1234-0567');
      expect(res.body.nombre).toBe('Carlos Renombrado');
    });

    it('debe actualizar el registro con la ruta alias /api/asociados/:id', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/asociados/${asociado1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'Nombre Vía Alias' });

      expect(res.status).toBe(200);
      expect(res.body.nombre).toBe('Nombre Vía Alias');
    });
  });

  describe('Unicidad de Cédula (Criterio de Aceptación)', () => {
    it('debe rechazar con 409 si la cédula modificada ya pertenece a otro asociado', async () => {
      const totalAntes = await asociadoRepository.count();

      const res = await patch(`${URL}/${asociado1.id}`, {
        cedula: '2-0456-0789', // Cédula de asociado2
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain(
        'Ya existe un asociado registrado con la cédula "2-0456-0789"',
      );

      // El asociado original no se modifica
      const sinCambios = await asociadoRepository.findOneBy({
        id: asociado1.id,
      });
      expect(sinCambios?.cedula).toBe('1-1234-0567');

      // No se crea un nuevo asociado
      const totalDespues = await asociadoRepository.count();
      expect(totalDespues).toBe(totalAntes);
    });
  });
});
