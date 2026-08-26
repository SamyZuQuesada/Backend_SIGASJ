import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from './proyecto.entity';

@Entity('ImagenProyecto')
export class ImagenProyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @ManyToOne(() => Proyecto, (proyecto) => proyecto.imagenes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proyectoId' })
  proyecto: Proyecto;

  @CreateDateColumn()
  createdAt: Date;
}

