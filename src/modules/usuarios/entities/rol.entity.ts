import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum';
import { Usuario } from './usuario.entity';

@Entity('Rol')
export class Rol {
  @ApiProperty({ example: 3 })
  @PrimaryGeneratedColumn()
  idRol: number;

  @ApiProperty({
    enum: Role,
    example: Role.FONTANERO,
    description:
      'Nombre único del rol. Varios usuarios pueden compartir FONTANERO.',
  })
  @Column({ type: 'varchar', length: 40, unique: true })
  nombre: Role;

  @OneToMany(() => Usuario, (usuario) => usuario.rol)
  usuarios: Usuario[];
}
