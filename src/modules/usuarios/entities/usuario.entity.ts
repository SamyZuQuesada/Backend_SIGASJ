import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Rol } from './rol.entity';

@Entity('Usuario')
export class Usuario {
  @ApiProperty({ example: 5 })
  @PrimaryGeneratedColumn()
  idUsuario: number;

  @ApiProperty({ example: 'Carlos Pérez' })
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @ApiProperty({ example: 'carlos@asadasanjuan.cr' })
  @Column({ type: 'varchar', length: 150, unique: true })
  correo: string;

  @ApiHideProperty()
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @ApiProperty({ example: true })
  @Column({ default: true })
  activo: boolean;

  @ApiProperty({ example: 3 })
  @Column({ type: 'int' })
  idRol: number;

  @ManyToOne(() => Rol, (rol) => rol.usuarios, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'idRol', referencedColumnName: 'idRol' })
  rol: Rol;

  @BeforeInsert()
  @BeforeUpdate()
  normalizarCorreo(): void {
    if (this.correo) {
      this.correo = this.correo.trim().toLowerCase();
    }
  }

  /**
   * `res.json` / `JSON.stringify` no deben incluir el hash aunque Auth lo
   * haya cargado con `addSelect('usuario.passwordHash')`.
   */
  toJSON(): Record<string, unknown> {
    return {
      idUsuario: this.idUsuario,
      nombre: this.nombre,
      correo: this.correo,
      activo: this.activo,
      idRol: this.idRol,
      ...(this.rol !== undefined ? { rol: this.rol } : {}),
    };
  }
}
