import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Abonado } from '../../abonados/entities/abonado.entity';

@Entity('Servicio')
export class Servicio {
  @PrimaryGeneratedColumn()
  idServicio: number;

  @Column({ type: 'int', unique: true })
  idAbonado: number;

  @OneToOne(() => Abonado, (abonado) => abonado.servicio, { nullable: false })
  @JoinColumn({ name: 'idAbonado', referencedColumnName: 'idAbonado' })
  abonado: Abonado;

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
