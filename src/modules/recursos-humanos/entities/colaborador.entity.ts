import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PermisoColaborador } from './permiso-colaborador.entity';

/**
 * Personal administrado desde Recursos Humanos (fontaneros y personal
 * administrativo). La cuenta de usuario es opcional: un colaborador puede
 * existir sin acceso a SIGASJ.
 */
@Entity('Colaborador')
@Index('UQ_Colaborador_cedula', ['cedula'], { unique: true })
@Index('UQ_Colaborador_usuarioId', ['usuarioId'], {
  unique: true,
  // SQL Server trata NULL como valor en UNIQUE; sin el filtro solo se
  // permitiría un colaborador sin cuenta.
  where: '"usuarioId" IS NOT NULL',
})
export class Colaborador {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del colaborador',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 'Carlos',
    description: 'Nombre de pila del colaborador',
  })
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @ApiProperty({
    example: 'Pérez Mora',
    description: 'Apellidos del colaborador',
  })
  @Column({ type: 'varchar', length: 100 })
  apellidos: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Cédula de identidad única del colaborador',
  })
  @Column({ type: 'varchar', length: 30 })
  cedula: string;

  @ApiProperty({
    example: 'carlos.perez@asadasanjuan.cr',
    description: 'Correo electrónico de contacto del colaborador',
  })
  @Column({ type: 'varchar', length: 150 })
  correoElectronico: string;

  @ApiProperty({
    example: 'Fontanero',
    description: 'Cargo o función del colaborador dentro de la ASADA',
  })
  @Column({ type: 'varchar', length: 100 })
  cargo: string;

  @ApiProperty({
    example: true,
    description: 'Estado activo/inactivo del colaborador',
    default: true,
  })
  @Column({ default: true })
  activo: boolean;

  @ApiProperty({
    example: 5,
    nullable: true,
    description:
      'Cuenta de usuario de SIGASJ asociada. NULL si el colaborador no tiene acceso al sistema',
  })
  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'usuarioId',
    referencedColumnName: 'idUsuario',
    foreignKeyConstraintName: 'FK_Colaborador_Usuario',
  })
  usuario: Usuario | null;

  @OneToMany(() => PermisoColaborador, (permiso) => permiso.colaborador)
  permisos: PermisoColaborador[];

  @ApiProperty({
    description: 'Fecha y hora de creación del registro',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última modificación del registro',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  asignarValoresPorDefecto(): void {
    if (this.activo === undefined) {
      this.activo = true;
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    if (this.nombre) {
      this.nombre = this.nombre.trim();
    }
    if (this.apellidos) {
      this.apellidos = this.apellidos.trim();
    }
    if (this.cedula) {
      this.cedula = this.cedula.trim();
    }
    if (this.correoElectronico) {
      this.correoElectronico = this.correoElectronico.trim().toLowerCase();
    }
    if (this.cargo) {
      this.cargo = this.cargo.trim();
    }
  }
}
