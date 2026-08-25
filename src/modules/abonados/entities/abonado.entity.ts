import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('Abonado')
export class Abonado {
  @PrimaryGeneratedColumn()
  idAbonado: number;

  @Column({ type: 'int', unique: true })
  idUsuario: number;

  @OneToOne(() => Usuario, (usuario) => usuario.abonado, { nullable: false })
  @JoinColumn({ name: 'idUsuario', referencedColumnName: 'idUsuario' })
  usuario: Usuario;
}
