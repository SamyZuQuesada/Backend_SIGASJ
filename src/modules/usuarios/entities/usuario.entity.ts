import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('Usuario')
export class Usuario {
  @PrimaryGeneratedColumn()
  idUsuario: number;
}
