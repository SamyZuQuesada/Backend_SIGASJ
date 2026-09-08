import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ActividadFontanero } from './actividad-fontanero.entity';

@Entity('DocumentoActividadFontanero')
export class DocumentoActividadFontanero {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombreOriginal: string;

  @Column({ type: 'varchar', length: 100 })
  tipoArchivo: string;

  @Column({ type: 'varchar', length: 500 })
  rutaReferenciaArchivo: string;

  @Column({ type: 'int' })
  tamanio: number;

  @CreateDateColumn()
  fechaCarga: Date;

  @ManyToOne(() => ActividadFontanero, (actividad) => actividad.documentos, {
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idActividad' })
  actividad: ActividadFontanero;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
