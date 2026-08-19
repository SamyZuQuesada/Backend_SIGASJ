import { Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Abonado } from '../../abonados/entities/abonado.entity';

@Entity('Usuario')
export class Usuario {
  @PrimaryGeneratedColumn()
  idUsuario: number;

  @OneToOne(() => Abonado, (abonado) => abonado.usuario)
  abonado?: Abonado;
}
