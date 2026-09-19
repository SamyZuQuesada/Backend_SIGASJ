import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiaSemana } from '../../common/enums/dia-semana.enum';
import { Role } from '../../common/enums/role.enum';
import {
  ahoraDelSistema,
  partesLaboralesEnAsada,
} from '../../common/time/reloj-asada';
import { HorarioLaboralFontanero } from './entities/horario-laboral-fontanero.entity';
import { Usuario } from './entities/usuario.entity';
import { normalizarHoraLaboral } from './horario-laboral-fontanero.validation';
import {
  EvaluacionHorarioLaboral,
  HorarioLaboralConsultado,
  MOTIVO_DENTRO_DE_HORARIO,
  MOTIVO_FONTANERO_INEXISTENTE,
  MOTIVO_FUERA_DE_HORARIO,
  MOTIVO_HORARIO_INCOMPLETO,
  MOTIVO_NO_ES_FONTANERO,
  MOTIVO_SIN_HORARIO,
  ResultadoHorarioLaboral,
  compararInstanteConHorario,
} from './validacion-horario-laboral-fontanero';

/**
 * Determina si un Fontanero está dentro de horario laboral.
 * La hora se toma del Backend (zona America/Costa_Rica), no del Frontend.
 */
@Injectable()
export class ValidacionHorarioLaboralFontaneroService {
  constructor(
    @InjectRepository(HorarioLaboralFontanero)
    private readonly horarios: Repository<HorarioLaboralFontanero>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  /** Punto de entrada para averías: siempre usa el reloj del servidor. */
  evaluarAhora(idFontanero: number): Promise<EvaluacionHorarioLaboral> {
    return this.evaluar(idFontanero, ahoraDelSistema());
  }

  /**
   * Evaluación reutilizable. `momento` solo para pruebas o relojes internos;
   * las operaciones de averías deben llamar `evaluarAhora`.
   */
  async evaluar(
    idFontanero: number,
    momento: Date,
  ): Promise<EvaluacionHorarioLaboral> {
    const partes = partesLaboralesEnAsada(momento);
    const diaSemana = partes.diaSemana as DiaSemana;
    const base = {
      idFontanero:
        Number.isInteger(idFontanero) && idFontanero > 0 ? idFontanero : null,
      momento: momento.toISOString(),
      diaSemana,
      horario: null as HorarioLaboralConsultado | null,
    };

    if (!Number.isInteger(idFontanero) || idFontanero <= 0) {
      return this.resultado(
        ResultadoHorarioLaboral.FONTANERO_INEXISTENTE,
        MOTIVO_FONTANERO_INEXISTENTE,
        base,
      );
    }

    const usuario = await this.usuarios.findOne({
      where: { idUsuario: idFontanero },
      relations: { rol: true },
    });
    if (!usuario) {
      return this.resultado(
        ResultadoHorarioLaboral.FONTANERO_INEXISTENTE,
        MOTIVO_FONTANERO_INEXISTENTE,
        { ...base, idFontanero },
      );
    }
    if (usuario.rol?.nombre !== Role.FONTANERO) {
      return this.resultado(
        ResultadoHorarioLaboral.NO_ES_FONTANERO,
        MOTIVO_NO_ES_FONTANERO,
        { ...base, idFontanero },
      );
    }

    const horariosDelDia = await this.horarios.find({
      where: { idFontanero, diaSemana, activo: true },
      order: { horaInicio: 'ASC' },
    });

    if (horariosDelDia.length === 0) {
      return this.resultado(
        ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO,
        MOTIVO_SIN_HORARIO,
        { ...base, idFontanero },
      );
    }

    let vioIncompleto = false;
    for (const fila of horariosDelDia) {
      const consultado = this.comoConsultado(fila);
      const comparacion = compararInstanteConHorario(
        consultado.horaInicio,
        consultado.horaFin,
        partes.segundosDesdeMedianoche,
      );
      if (comparacion === 'incompleto') {
        vioIncompleto = true;
        continue;
      }
      if (comparacion === 'dentro') {
        return this.resultado(
          ResultadoHorarioLaboral.DENTRO_DE_HORARIO,
          MOTIVO_DENTRO_DE_HORARIO,
          { ...base, idFontanero, horario: consultado },
        );
      }
    }

    if (vioIncompleto) {
      return this.resultado(
        ResultadoHorarioLaboral.HORARIO_INCOMPLETO,
        MOTIVO_HORARIO_INCOMPLETO,
        {
          ...base,
          idFontanero,
          horario: this.comoConsultado(horariosDelDia[0]),
        },
      );
    }

    return this.resultado(
      ResultadoHorarioLaboral.FUERA_DE_HORARIO,
      MOTIVO_FUERA_DE_HORARIO,
      {
        ...base,
        idFontanero,
        horario: this.comoConsultado(horariosDelDia[0]),
      },
    );
  }

  private comoConsultado(
    fila: HorarioLaboralFontanero,
  ): HorarioLaboralConsultado {
    return {
      id: fila.id,
      diaSemana: fila.diaSemana,
      horaInicio: normalizarHoraLaboral(fila.horaInicio) ?? String(fila.horaInicio ?? ''),
      horaFin: normalizarHoraLaboral(fila.horaFin) ?? String(fila.horaFin ?? ''),
      activo: fila.activo,
    };
  }

  private resultado(
    resultado: ResultadoHorarioLaboral,
    motivo: string,
    extras: {
      idFontanero: number | null;
      momento: string;
      diaSemana: DiaSemana | null;
      horario: HorarioLaboralConsultado | null;
    },
  ): EvaluacionHorarioLaboral {
    return {
      resultado,
      puedeIniciarAtencion:
        resultado === ResultadoHorarioLaboral.DENTRO_DE_HORARIO,
      motivo,
      ...extras,
    };
  }
}
