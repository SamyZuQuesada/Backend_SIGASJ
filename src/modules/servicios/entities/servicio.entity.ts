import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('Servicio')
export class Servicio {
  @PrimaryGeneratedColumn()
  idServicio: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  nis: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  medidor: string;

  @Column({ type: 'varchar', length: 100 })
  sector: string;

  @Column({ type: 'varchar', length: 50 })
  tarifa: string;

  @Column({ type: 'varchar', length: 50 })
  numeroPlano: string;
}
