import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DiaSemana } from '../../../common/enums/dia-semana.enum';
import {
  MENSAJE_HORA_FORMATO_INVALIDO,
  MENSAJE_HORA_INICIO_NO_ANTERIOR,
  esHoraInicioAnteriorAFin,
  normalizarHoraLaboral,
} from '../horario-laboral-fontanero.validation';
import { Usuario } from './usuario.entity';

const horaLaboralTransformer = {
  to: (valor: string): string => valor,
  from: (valor: unknown): string => normalizarHoraLaboral(valor) ?? '',
};

/**
 * Horario habitual de un Fontanero para un día de la semana.
 * Un Fontanero puede tener un registro por día; `activo` permite
 * desactivar un día sin borrar la fila.
 */
@Entity('HorarioLaboralFontanero')
@Index('UQ_HorarioLaboralFontanero_Fontanero_Dia', ['idFontanero', 'diaSemana'], {
  unique: true,
})
export class HorarioLaboralFontanero {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  idFontanero: number;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idFontanero', referencedColumnName: 'idUsuario' })
  fontanero: Usuario;

  @Column({ type: 'int' })
  diaSemana: DiaSemana;

  @Column({ type: 'time', transformer: horaLaboralTransformer })
  horaInicio: string;

  @Column({ type: 'time', transformer: horaLaboralTransformer })
  horaFin: string;

  @Column({ default: true })
  activo: boolean;

  @BeforeInsert()
  @BeforeUpdate()
  normalizarYValidarHoras(): void {
    const inicio = normalizarHoraLaboral(this.horaInicio);
    const fin = normalizarHoraLaboral(this.horaFin);
    if (!inicio || !fin) {
      throw new Error(MENSAJE_HORA_FORMATO_INVALIDO);
    }
    this.horaInicio = inicio;
    this.horaFin = fin;
    if (!esHoraInicioAnteriorAFin(this.horaInicio, this.horaFin)) {
      throw new Error(MENSAJE_HORA_INICIO_NO_ANTERIOR);
    }
  }
}
