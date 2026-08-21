import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('Comunicado')
export class Comunicado {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  descripcion: string;

  @Column({ type: 'varchar', length: 4000, nullable: true })
  contenido: string | null;

  @Column({ type: 'varchar', length: 80, default: 'Informativo' })
  tipo: string;

  @Column({ type: 'varchar', length: 20, default: 'Media' })
  prioridad: string;

  @Column({ type: 'varchar', length: 20, default: 'Activo' })
  estado: string;

  @Column({ default: true })
  esPublico: boolean;

  @Column({ type: 'datetime' })
  fechaPublicacion: Date;

  @Column({ type: 'datetime', nullable: true })
  fechaExpiracion: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagenUrl: string | null;
}
