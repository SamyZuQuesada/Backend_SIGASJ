import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('TransparenciaDocumento')
export class TransparenciaDocumento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  descripcionBreve: string;

  @Column({ type: 'varchar', length: 500 })
  archivoUrl: string;

  @Column({ type: 'varchar', length: 10, default: 'pdf' })
  tipoArchivo: string;

  @Column({ type: 'int', default: 0 })
  ordenVisualizacion: number;

  @Column({ default: true })
  activa: boolean;
}
