import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoActividadFontanero } from '../../../common/enums/estado-actividad-fontanero.enum';

@Entity('ActividadFontanero')
export class ActividadFontanero {
  @PrimaryGeneratedColumn()
  id: number;

  /** Identidad del fontanero dueño; siempre proviene del JWT, nunca del cliente. */
  @Column({ type: 'varchar', length: 100 })
  fontaneroId: string;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ubicacion: string | null;

  @Column({
    type: 'varchar',
    length: 40,
    default: EstadoActividadFontanero.REPORTADA,
  })
  estado: EstadoActividadFontanero;

  @Column({ type: 'text', nullable: true })
  observacionCorreccion: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  revisadoPorId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
