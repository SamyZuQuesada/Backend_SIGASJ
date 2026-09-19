import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DiaSemana } from '../../common/enums/dia-semana.enum';
import { Role } from '../../common/enums/role.enum';
import { ahoraDelSistema, fechaEnAsada } from '../../common/time/reloj-asada';
import { HorarioLaboralFontanero } from './entities/horario-laboral-fontanero.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import {
  MOTIVO_DENTRO_DE_HORARIO,
  MOTIVO_FONTANERO_INEXISTENTE,
  MOTIVO_FUERA_DE_HORARIO,
  MOTIVO_HORARIO_INCOMPLETO,
  MOTIVO_NO_ES_FONTANERO,
  MOTIVO_SIN_HORARIO,
  ResultadoHorarioLaboral,
} from './validacion-horario-laboral-fontanero';
import { ValidacionHorarioLaboralFontaneroService } from './validacion-horario-laboral-fontanero.service';
import { crearUsuarioPrueba, seedRolesBase } from './usuarios.test-helpers';

describe('ValidacionHorarioLaboralFontaneroService', () => {
  jest.setTimeout(30_000);
  let moduleRef: TestingModule;
  let service: ValidacionHorarioLaboralFontaneroService;
  let horarios: Repository<HorarioLaboralFontanero>;
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
      providers: [ValidacionHorarioLaboralFontaneroService],
    }).compile();

    service = moduleRef.get(ValidacionHorarioLaboralFontaneroService);
    const dataSource = moduleRef.get(DataSource);
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    const usuarios = dataSource.getRepository(Usuario);
    const roles = await seedRolesBase(dataSource.getRepository(Rol));
    fontanero = await crearUsuarioPrueba(usuarios, roles, {
      nombre: 'Fontanero validación',
      correo: 'fontanero.validacion@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    administradora = await crearUsuarioPrueba(usuarios, roles, {
      nombre: 'Admin validación',
      correo: 'admin.validacion@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await horarios.clear();
  });

  const horarioLunes = async () => {
    await horarios.save(
      horarios.create({
        idFontanero: fontanero.idUsuario,
        diaSemana: DiaSemana.LUNES,
        horaInicio: '07:00:00',
        horaFin: '16:00:00',
        activo: true,
      }),
    );
  };

  it('indica que está dentro de horario en un lunes laboral', async () => {
    await horarioLunes();
    const evaluacion = await service.evaluar(
      fontanero.idUsuario,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(evaluacion.resultado).toBe(ResultadoHorarioLaboral.DENTRO_DE_HORARIO);
    expect(evaluacion.puedeIniciarAtencion).toBe(true);
    expect(evaluacion.motivo).toBe(MOTIVO_DENTRO_DE_HORARIO);
    expect(evaluacion.diaSemana).toBe(DiaSemana.LUNES);
    expect(evaluacion.horario?.horaInicio).toBe('07:00:00');
    expect(evaluacion.horario?.horaFin).toBe('16:00:00');
  });

  it('indica que está fuera de horario al cierre o en otro día', async () => {
    await horarioLunes();
    const antesDelInicio = await service.evaluar(
      fontanero.idUsuario,
      fechaEnAsada(2026, 8, 21, 6, 59, 0),
    );
    expect(antesDelInicio.resultado).toBe(ResultadoHorarioLaboral.FUERA_DE_HORARIO);
    expect(antesDelInicio.puedeIniciarAtencion).toBe(false);
    expect(antesDelInicio.motivo).toBe(MOTIVO_FUERA_DE_HORARIO);

    const alCierre = await service.evaluar(
      fontanero.idUsuario,
      fechaEnAsada(2026, 8, 21, 16, 0, 0),
    );
    expect(alCierre.resultado).toBe(ResultadoHorarioLaboral.FUERA_DE_HORARIO);
    expect(alCierre.puedeIniciarAtencion).toBe(false);
    expect(alCierre.motivo).toBe(MOTIVO_FUERA_DE_HORARIO);

    const martes = await service.evaluar(
      fontanero.idUsuario,
      fechaEnAsada(2026, 8, 22, 10, 0, 0),
    );
    expect(martes.resultado).toBe(ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO);
    expect(martes.puedeIniciarAtencion).toBe(false);
    expect(martes.motivo).toBe(MOTIVO_SIN_HORARIO);
  });

  it('no asume atención posible si no hay horario o está inactivo', async () => {
    const sinFila = await service.evaluar(
      fontanero.idUsuario,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(sinFila.resultado).toBe(ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO);
    expect(sinFila.puedeIniciarAtencion).toBe(false);

    await horarios.save(
      horarios.create({
        idFontanero: fontanero.idUsuario,
        diaSemana: DiaSemana.LUNES,
        horaInicio: '07:00:00',
        horaFin: '16:00:00',
        activo: false,
      }),
    );
    const inactivo = await service.evaluar(
      fontanero.idUsuario,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(inactivo.resultado).toBe(
      ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO,
    );
    expect(inactivo.puedeIniciarAtencion).toBe(false);
  });

  it('trata un id inválido como Fontanero inexistente', async () => {
    const evaluacion = await service.evaluar(
      0,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(evaluacion.resultado).toBe(
      ResultadoHorarioLaboral.FONTANERO_INEXISTENTE,
    );
    expect(evaluacion.puedeIniciarAtencion).toBe(false);
    expect(evaluacion.idFontanero).toBeNull();
  });

  it('maneja Fontanero inexistente y usuario que no es Fontanero', async () => {
    const inexistente = await service.evaluar(
      9_999_999,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(inexistente.resultado).toBe(
      ResultadoHorarioLaboral.FONTANERO_INEXISTENTE,
    );
    expect(inexistente.puedeIniciarAtencion).toBe(false);
    expect(inexistente.motivo).toBe(MOTIVO_FONTANERO_INEXISTENTE);

    const noFontanero = await service.evaluar(
      administradora.idUsuario,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(noFontanero.resultado).toBe(ResultadoHorarioLaboral.NO_ES_FONTANERO);
    expect(noFontanero.motivo).toBe(MOTIVO_NO_ES_FONTANERO);
    expect(noFontanero.puedeIniciarAtencion).toBe(false);
  });

  it('detecta un horario incompleto sin lanzar error inesperado', async () => {
    await horarios.insert({
      idFontanero: fontanero.idUsuario,
      diaSemana: DiaSemana.LUNES,
      horaInicio: '25:99:00',
      horaFin: '16:00:00',
      activo: true,
    });
    const evaluacion = await service.evaluar(
      fontanero.idUsuario,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(evaluacion.resultado).toBe(ResultadoHorarioLaboral.HORARIO_INCOMPLETO);
    expect(evaluacion.puedeIniciarAtencion).toBe(false);
    expect(evaluacion.motivo).toBe(MOTIVO_HORARIO_INCOMPLETO);
  });

  it('evaluarAhora usa el reloj del Backend', async () => {
    await horarioLunes();
    const antes = ahoraDelSistema().getTime();
    const evaluacion = await service.evaluarAhora(fontanero.idUsuario);
    const despues = ahoraDelSistema().getTime();
    const marca = Date.parse(evaluacion.momento);
    expect(marca).toBeGreaterThanOrEqual(antes - 1000);
    expect(marca).toBeLessThanOrEqual(despues + 1000);
    expect(evaluacion.resultado).toBeDefined();
    expect(typeof evaluacion.puedeIniciarAtencion).toBe('boolean');
  });
});
