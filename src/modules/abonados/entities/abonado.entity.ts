import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Servicio } from '../../servicios/entities/servicio.entity';

@Entity('Abonado')
export class Abonado {
  @PrimaryGeneratedColumn()
  idAbonado: number;

  @Column({ type: 'int', unique: true })
  idUsuario: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  apellidos: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  cedula: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 120 })
  correo: string;

  @Column({ type: 'varchar', length: 300 })
  direccion: string;

  @OneToOne(() => Usuario, (usuario) => usuario.abonado, { nullable: false })
  @JoinColumn({ name: 'idUsuario', referencedColumnName: 'idUsuario' })
  usuario: Usuario;

  @OneToOne(() => Servicio, (servicio) => servicio.abonado)
  servicio?: Servicio;
}
