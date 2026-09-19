import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Averia } from './averia.entity';

/**
 * Observación de atención registrada por el Fontanero asignado.
 * Una Avería puede tener muchas filas; no sustituye `Averia.observacionesAtencion`.
 */
@Entity('ObservacionAveria')
export class ObservacionAveria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  idAveria: number;

  @ManyToOne(() => Averia, (averia) => averia.observaciones, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idAveria', referencedColumnName: 'id' })
  averia: Averia;

  @Column({ type: 'int' })
  idUsuarioAutor: number;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idUsuarioAutor', referencedColumnName: 'idUsuario' })
  autor: Usuario;

  @Column({ type: 'varchar', length: 2000 })
  observacion: string;

  @CreateDateColumn()
  fechaCreacion: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizarObservacion(): void {
    if (typeof this.observacion === 'string') {
      this.observacion = this.observacion.trim();
    }
  }
}
