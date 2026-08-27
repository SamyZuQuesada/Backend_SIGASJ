import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoProyecto } from '../../../common/enums/estado-proyecto.enum';
import { ImagenProyecto } from './imagen-proyecto.entity';

@Entity('Proyecto')
export class Proyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  encargadoRealizacion: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  duracion: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: EstadoProyecto.PENDIENTE,
  })
  estado: EstadoProyecto;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagenPrincipal: string | null;

  /** Visibilidad pública. Independiente de `estado` (ciclo de ejecución). Alta: no publicado. */
  @Column({ default: false })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ImagenProyecto, (imagen) => imagen.proyecto, {
    cascade: true,
  })
  imagenes: ImagenProyecto[];
}
