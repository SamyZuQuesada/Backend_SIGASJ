import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Entidad que representa a un Asociado dentro de SIGASJ (ASADA San Juan).
 * Almacena los datos de identificación, contacto, estado y fechas de membresía/registro.
 */
@Entity('Asociado')
export class Asociado {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del asociado',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 'Juan',
    description: 'Nombre de pila del asociado',
  })
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @ApiProperty({
    example: 'Pérez Rodríguez',
    description: 'Apellidos del asociado',
  })
  @Column({ type: 'varchar', length: 100 })
  apellidos: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Cédula o número de documento de identidad único del asociado',
  })
  @Column({ type: 'varchar', length: 30, unique: true })
  cedula: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Correo electrónico de contacto del asociado',
  })
  @Column({ type: 'varchar', length: 150 })
  correoElectronico: string;

  @ApiProperty({
    example: true,
    description: 'Estado activo/inactivo del asociado dentro de la ASADA',
    default: true,
  })
  @Column({ default: true })
  activo: boolean;

  @ApiProperty({
    example: '2026-01-15T08:00:00.000Z',
    description:
      'Fecha en la que el asociado fue registrado formalmente en la ASADA',
  })
  @Column({ type: 'datetime' })
  fechaRegistro: Date;

  @ApiProperty({
    example: null,
    nullable: true,
    description:
      'Fecha en la que el asociado fue inactivado. Permanece en NULL mientras el asociado esté activo',
  })
  @Column({ type: 'datetime', nullable: true })
  fechaInactivacion: Date | null;

  @ApiProperty({
    description: 'Fecha y hora de creación del registro en la base de datos',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description:
      'Fecha y hora de última modificación del registro en la base de datos',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  asignarValoresPorDefecto(): void {
    if (!this.fechaRegistro) {
      this.fechaRegistro = new Date();
    }
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
  }
}
