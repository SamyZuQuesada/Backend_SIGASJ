import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DiaSemana } from '../../common/enums/dia-semana.enum';
import { Role } from '../../common/enums/role.enum';
import { HorarioLaboralFontanero } from './entities/horario-laboral-fontanero.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import {
  HorariosLaboralesFontaneroService,
  MENSAJE_DIA_SEMANA_INVALIDO,
  MENSAJE_USUARIO_NO_FONTANERO,
} from './horarios-laborales-fontanero.service';
import { MENSAJE_HORA_INICIO_NO_ANTERIOR } from './horario-laboral-fontanero.validation';
import { crearUsuarioPrueba, seedRolesBase } from './usuarios.test-helpers';

describe('Horarios laborales del Fontanero', () => {
  jest.setTimeout(30_000);
  let moduleRef: TestingModule;
  let service: HorariosLaboralesFontaneroService;
  let horarios: Repository<HorarioLaboralFontanero>;
  let usuarios: Repository<Usuario>;
  let fontanero: Usuario;
  let administradora: Usuario;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Usuario, Rol, HorarioLaboralFontanero],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Usuario, Rol, HorarioLaboralFontanero]),
      ],
      providers: [HorariosLaboralesFontaneroService],
    }).compile();

    service = moduleRef.get(HorariosLaboralesFontaneroService);
    const dataSource = moduleRef.get(DataSource);
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    usuarios = dataSource.getRepository(Usuario);
    const roles = await seedRolesBase(dataSource.getRepository(Rol));
    fontanero = await crearUsuarioPrueba(usuarios, roles, {
      nombre: 'Fontanero horarios',
      correo: 'fontanero.horarios@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    administradora = await crearUsuarioPrueba(usuarios, roles, {
      nombre: 'Administradora horarios',
      correo: 'admin.horarios@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await horarios.clear();
  });

  it('persiste un horario por día y varios días para el mismo Fontanero', async () => {
    await service.definirHorario({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.LUNES,
      horaInicio: '07:00',
      horaFin: '16:00',
    });
    await service.definirHorario({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.MARTES,
      horaInicio: '07:00',
      horaFin: '16:00',
    });

    const lista = await service.listarPorFontanero(fontanero.idUsuario);
    expect(lista).toHaveLength(2);
    expect(lista.map((item) => item.diaSemana)).toEqual([
      DiaSemana.LUNES,
      DiaSemana.MARTES,
    ]);
    expect(lista[0]?.horaInicio).toBe('07:00:00');
    expect(lista[0]?.horaFin).toBe('16:00:00');
    expect(lista[0]?.activo).toBe(true);
    expect(lista[0]?.idFontanero).toBe(fontanero.idUsuario);
  });

  it('consulta los horarios activos de un Fontanero en un día', async () => {
    await service.definirHorario({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.MIERCOLES,
      horaInicio: '07:00',
      horaFin: '16:00',
    });
    const activos = await service.listarActivosPorFontaneroYDia(
      fontanero.idUsuario,
      DiaSemana.MIERCOLES,
    );
    expect(activos).toHaveLength(1);
    expect(
      await service.listarActivosPorFontaneroYDia(
        fontanero.idUsuario,
        DiaSemana.JUEVES,
      ),
    ).toHaveLength(0);
  });

  it('rechaza hora de inicio igual o posterior a la de salida', async () => {
    await expect(
      service.definirHorario({
        idFontanero: fontanero.idUsuario,
        diaSemana: DiaSemana.LUNES,
        horaInicio: '16:00',
        horaFin: '07:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.definirHorario({
        idFontanero: fontanero.idUsuario,
        diaSemana: DiaSemana.LUNES,
        horaInicio: '07:00',
        horaFin: '07:00',
      }),
    ).rejects.toMatchObject({ message: MENSAJE_HORA_INICIO_NO_ANTERIOR });
  });

  it('rechaza día de la semana inválido', async () => {
    await expect(
      service.definirHorario({
        idFontanero: fontanero.idUsuario,
        diaSemana: 0 as DiaSemana,
        horaInicio: '07:00',
        horaFin: '16:00',
      }),
    ).rejects.toMatchObject({ message: MENSAJE_DIA_SEMANA_INVALIDO });
  });

  it('solo relaciona horarios con usuarios Fontanero', async () => {
    await expect(
      service.definirHorario({
        idFontanero: administradora.idUsuario,
        diaSemana: DiaSemana.LUNES,
        horaInicio: '07:00',
        horaFin: '16:00',
      }),
    ).rejects.toMatchObject({ message: MENSAJE_USUARIO_NO_FONTANERO });

    await expect(
      service.definirHorario({
        idFontanero: 9_999_999,
        diaSemana: DiaSemana.LUNES,
        horaInicio: '07:00',
        horaFin: '16:00',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('impide dos filas activas distintas para el mismo Fontanero y día', async () => {
    await service.definirHorario({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.VIERNES,
      horaInicio: '07:00',
      horaFin: '16:00',
    });
    const actualizado = await service.definirHorario({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.VIERNES,
      horaInicio: '08:00',
      horaFin: '15:00',
    });
    const lista = await service.listarPorFontanero(fontanero.idUsuario);
    expect(lista).toHaveLength(1);
    expect(actualizado.horaInicio).toBe('08:00:00');
    expect(actualizado.horaFin).toBe('15:00:00');
  });

  it('permite desactivar un horario y deja de considerarlo en la consulta del día', async () => {
    const creado = await service.definirHorario({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.LUNES,
      horaInicio: '07:00',
      horaFin: '16:00',
    });
    await service.cambiarActivo(creado.id, false);
    expect(
      await service.listarActivosPorFontaneroYDia(
        fontanero.idUsuario,
        DiaSemana.LUNES,
      ),
    ).toHaveLength(0);
    const persistido = await service.listarPorFontanero(fontanero.idUsuario);
    expect(persistido[0]?.activo).toBe(false);
  });

  it('prepara la consulta de si el Fontanero está dentro de horario', async () => {
    await service.definirHorario({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.LUNES,
      horaInicio: '07:00',
      horaFin: '16:00',
    });
    const lunesManana = new Date(2026, 8, 21, 10, 0, 0);
    const lunesTarde = new Date(2026, 8, 21, 16, 0, 0);
    const martesManana = new Date(2026, 8, 22, 10, 0, 0);

    expect(await service.estaDentroDeHorarioLaboral(fontanero.idUsuario, lunesManana)).toBe(
      true,
    );
    expect(await service.estaDentroDeHorarioLaboral(fontanero.idUsuario, lunesTarde)).toBe(
      false,
    );
    expect(
      await service.estaDentroDeHorarioLaboral(fontanero.idUsuario, martesManana),
    ).toBe(false);
  });
});
