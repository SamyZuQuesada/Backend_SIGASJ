import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('GaleriaFoto')
export class GaleriaFoto {
  @PrimaryGeneratedColumn()
  idGaleriaFoto: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  titulo: string | null;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 500 })
  imagenUrl: string;

  @Column({ type: 'varchar', length: 300 })
  textoAlternativo: string;

  @Column({ type: 'int', default: 0 })
  ordenVisualizacion: number;

  @Column({ type: 'bit', default: true })
  activo: boolean;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
