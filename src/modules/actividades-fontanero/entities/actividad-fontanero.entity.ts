import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoActividadFontanero } from '../../../common/enums/estado-actividad-fontanero.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DocumentoActividadFontanero } from './documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './tipo-actividad-fontanero.entity';

/**
 * Registro principal de una actividad realizada por un fontanero.
 * Los detalles específicos de cada formulario se modelan en entidades aparte.
 */
@Entity('ActividadFontanero')
export class ActividadFontanero {
  @PrimaryGeneratedColumn()
  id: number;

  /** Identidad del fontanero dueño; proviene del JWT hasta enlazar idUsuario. */
  @Column({ type: 'varchar', length: 100 })
  fontaneroId: string;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'idUsuario' })
  fontanero: Usuario | null;

  @ManyToOne(() => TipoActividadFontanero, (tipo) => tipo.actividades, {
    nullable: true,
  })
  @JoinColumn({ name: 'idTipoActividad' })
  tipoActividad: TipoActividadFontanero | null;

  @OneToMany(
    () => DocumentoActividadFontanero,
    (documento) => documento.actividad,
  )
  documentos: DocumentoActividadFontanero[];

  @Column({ type: 'date', nullable: true })
  fechaActividad: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  /** Resumen breve usado por el flujo operativo actual (endpoint Wuipy). */
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

  @Column({ type: 'datetime', nullable: true })
  fechaRevision: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  datosEspecificos: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
