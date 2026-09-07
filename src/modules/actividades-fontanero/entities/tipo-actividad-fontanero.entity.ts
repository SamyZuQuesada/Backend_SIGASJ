import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoActividadFontaneroCodigo } from '../../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { ActividadFontanero } from './actividad-fontanero.entity';

@Entity('TipoActividadFontanero')
export class TipoActividadFontanero {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  codigo: TipoActividadFontaneroCodigo;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @OneToMany(() => ActividadFontanero, (actividad) => actividad.tipoActividad)
  actividades: ActividadFontanero[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
