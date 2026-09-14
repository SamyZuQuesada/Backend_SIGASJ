import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('GaleriaFoto')
export class GaleriaFoto {
  @PrimaryGeneratedColumn({ name: 'idGaleriaFoto' })
  id: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  titulo: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ name: 'imagenUrl', type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255 })
  textoAlternativo: string;

  @Column({ type: 'int', default: 0 })
  ordenVisualizacion: number;

  @Column({ name: 'activo', default: true })
  activa: boolean;
}
