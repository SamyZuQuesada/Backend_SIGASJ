import {
  BeforeInsert,
  BeforeRemove,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoAveria } from '../../../common/enums/estado-averia.enum';
import { TipoEventoAveria } from '../../../common/enums/tipo-evento-averia.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Averia } from './averia.entity';

export const HISTORIAL_AVERIA_NO_MODIFICABLE =
  'El historial de una avería no se puede modificar.';
export const HISTORIAL_AVERIA_NO_ELIMINABLE =
  'El historial de una avería no se puede eliminar.';

/**
 * Traza inmutable de un evento del ciclo de vida de una avería.
 * La fecha y el usuario los asigna el Backend. No hay actualización ni baja
 * desde las operaciones normales del sistema.
 */
@Entity('HistorialAveria')
@Index('IX_HistorialAveria_idAveria_fechaHora', ['idAveria', 'fechaHora'])
export class HistorialAveria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  idAveria: number;

  @ManyToOne(() => Averia, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idAveria', referencedColumnName: 'id' })
  averia: Averia;

  @Column({ type: 'varchar', length: 40 })
  tipoEvento: TipoEventoAveria;

  @Column({ type: 'varchar', length: 500 })
  descripcion: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  estadoAnterior: EstadoAveria | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  estadoNuevo: EstadoAveria | null;

  @Index('IX_HistorialAveria_idUsuario')
  @Column({ type: 'int', nullable: true })
  idUsuario: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idUsuario', referencedColumnName: 'idUsuario' })
  usuario: Usuario | null;

  @Column({ type: 'datetime' })
  fechaHora: Date;

  /** Tabla de referencia (ObservacionAveria, SolicitudMaterial, etc.). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  referenciaTipo: string | null;

  @Column({ type: 'int', nullable: true })
  referenciaId: number | null;

  @BeforeInsert()
  fijarFechaHoraDelServidor(): void {
    this.fechaHora = new Date();
  }

  @BeforeUpdate()
  impedirModificacion(): void {
    throw new Error(HISTORIAL_AVERIA_NO_MODIFICABLE);
  }

  @BeforeRemove()
  impedirEliminacion(): void {
    throw new Error(HISTORIAL_AVERIA_NO_ELIMINABLE);
  }
}
