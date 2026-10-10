import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AfterLoad,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { aFechaIso } from '../fecha-permiso';
import { Colaborador } from './colaborador.entity';

/**
 * Registro administrativo de un permiso otorgado a un colaborador.
 * No modela solicitud ni aprobación: la administradora lo anota y conserva.
 */
@Entity('PermisoColaborador')
@Index('IX_PermisoColaborador_colaboradorId', ['colaboradorId'])
@Index('IX_PermisoColaborador_fechas', ['fechaInicio', 'fechaFin'])
export class PermisoColaborador {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del permiso',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 3,
    description: 'Colaborador al que pertenece el permiso',
  })
  @Column({ type: 'int' })
  colaboradorId: number;

  @ManyToOne(() => Colaborador, (colaborador) => colaborador.permisos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'colaboradorId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_PermisoColaborador_Colaborador',
  })
  colaborador: Colaborador;

  @ApiProperty({
    example: '2026-10-12',
    description: 'Primer día del permiso (YYYY-MM-DD)',
  })
  @Column({ type: 'varchar', length: 10 })
  fechaInicio: string;

  @ApiProperty({
    example: '2026-10-14',
    description: 'Último día del permiso (YYYY-MM-DD)',
  })
  @Column({ type: 'varchar', length: 10 })
  fechaFin: string;

  @ApiProperty({
    example: 'Cita médica',
    description: 'Motivo del permiso',
  })
  @Column({ type: 'varchar', length: 200 })
  motivo: string;

  @ApiPropertyOptional({
    example: 'Requiere cobertura del ayudante',
    nullable: true,
    description: 'Observaciones adicionales del registro',
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

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

  @AfterLoad()
  hidratarFechas(): void {
    if (this.fechaInicio) {
      this.fechaInicio = aFechaIso(this.fechaInicio);
    }
    if (this.fechaFin) {
      this.fechaFin = aFechaIso(this.fechaFin);
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    if (this.fechaInicio) {
      this.fechaInicio = aFechaIso(this.fechaInicio);
    }
    if (this.fechaFin) {
      this.fechaFin = aFechaIso(this.fechaFin);
    }
    if (this.motivo) {
      this.motivo = this.motivo.trim();
    }
    if (this.observaciones) {
      this.observaciones = this.observaciones.trim();
    } else if (this.observaciones === '') {
      this.observaciones = null;
    }
  }
}
