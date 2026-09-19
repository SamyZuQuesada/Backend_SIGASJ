import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DiaSemana,
  diaSemanaDesdeFecha,
  isDiaSemanaValido,
} from '../../common/enums/dia-semana.enum';
import { Role } from '../../common/enums/role.enum';
import { HorarioLaboralFontanero } from './entities/horario-laboral-fontanero.entity';
import { Usuario } from './entities/usuario.entity';
import {
  MENSAJE_HORA_FORMATO_INVALIDO,
  MENSAJE_HORA_INICIO_NO_ANTERIOR,
  esHoraInicioAnteriorAFin,
  horaLaboralASegundos,
  segundosDesdeMedianoche,
  normalizarHoraLaboral,
} from './horario-laboral-fontanero.validation';

export type DefinirHorarioLaboralInput = {
  idFontanero: number;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  activo?: boolean;
};

export const MENSAJE_DIA_SEMANA_INVALIDO =
  'El día de la semana no es válido. Use 1 (lunes) a 7 (domingo).';

export const MENSAJE_USUARIO_NO_FONTANERO =
  'Solo se pueden definir horarios laborales para usuarios con rol Fontanero.';

@Injectable()
export class HorariosLaboralesFontaneroService {
  constructor(
    @InjectRepository(HorarioLaboralFontanero)
    private readonly horarios: Repository<HorarioLaboralFontanero>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  async listarPorFontanero(
    idFontanero: number,
  ): Promise<HorarioLaboralFontanero[]> {
    return this.horarios.find({
      where: { idFontanero },
      order: { diaSemana: 'ASC' },
    });
  }

  async listarActivosPorFontaneroYDia(
    idFontanero: number,
    diaSemana: DiaSemana,
  ): Promise<HorarioLaboralFontanero[]> {
    if (!isDiaSemanaValido(diaSemana)) {
      throw new BadRequestException(MENSAJE_DIA_SEMANA_INVALIDO);
    }
    return this.horarios.find({
      where: { idFontanero, diaSemana, activo: true },
      order: { horaInicio: 'ASC' },
    });
  }

  async definirHorario(
    input: DefinirHorarioLaboralInput,
  ): Promise<HorarioLaboralFontanero> {
    await this.assertEsFontanero(input.idFontanero);
    const normalizado = this.validarCamposHorario(input);

    const existente = await this.horarios.findOne({
      where: {
        idFontanero: input.idFontanero,
        diaSemana: normalizado.diaSemana,
      },
    });

    if (existente) {
      existente.horaInicio = normalizado.horaInicio;
      existente.horaFin = normalizado.horaFin;
      if (input.activo !== undefined) {
        existente.activo = input.activo;
      }
      return this.horarios.save(existente);
    }

    return this.horarios.save(
      this.horarios.create({
        idFontanero: input.idFontanero,
        diaSemana: normalizado.diaSemana,
        horaInicio: normalizado.horaInicio,
        horaFin: normalizado.horaFin,
        activo: input.activo ?? true,
      }),
    );
  }

  async cambiarActivo(
    idHorario: number,
    activo: boolean,
  ): Promise<HorarioLaboralFontanero> {
    const horario = await this.horarios.findOne({ where: { id: idHorario } });
    if (!horario) {
      throw new NotFoundException('El horario laboral no existe.');
    }
    horario.activo = activo;
    return this.horarios.save(horario);
  }

  /**
   * Consulta preparada para el paso de averías «¿Horario laboral?».
   * No cubre vacaciones, incapacidades ni feriados.
   */
  async estaDentroDeHorarioLaboral(
    idFontanero: number,
    momento: Date = new Date(),
  ): Promise<boolean> {
    const diaSemana = diaSemanaDesdeFecha(momento);
    const horarios = await this.listarActivosPorFontaneroYDia(
      idFontanero,
      diaSemana,
    );
    const instante = segundosDesdeMedianoche(momento);
    return horarios.some((horario) => {
      const inicio = horaLaboralASegundos(horario.horaInicio);
      const fin = horaLaboralASegundos(horario.horaFin);
      if (inicio === null || fin === null) {
        return false;
      }
      return instante >= inicio && instante < fin;
    });
  }

  private async assertEsFontanero(idFontanero: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({
      where: { idUsuario: idFontanero },
      relations: { rol: true },
    });
    if (!usuario) {
      throw new NotFoundException('El Fontanero no existe.');
    }
    if (usuario.rol?.nombre !== Role.FONTANERO) {
      throw new BadRequestException(MENSAJE_USUARIO_NO_FONTANERO);
    }
    return usuario;
  }

  private validarCamposHorario(input: DefinirHorarioLaboralInput): {
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
  } {
    if (!isDiaSemanaValido(input.diaSemana)) {
      throw new BadRequestException(MENSAJE_DIA_SEMANA_INVALIDO);
    }
    const horaInicio = normalizarHoraLaboral(input.horaInicio);
    const horaFin = normalizarHoraLaboral(input.horaFin);
    if (!horaInicio || !horaFin) {
      throw new BadRequestException(MENSAJE_HORA_FORMATO_INVALIDO);
    }
    if (!esHoraInicioAnteriorAFin(horaInicio, horaFin)) {
      throw new BadRequestException(MENSAJE_HORA_INICIO_NO_ANTERIOR);
    }
    return { diaSemana: input.diaSemana, horaInicio, horaFin };
  }
}
