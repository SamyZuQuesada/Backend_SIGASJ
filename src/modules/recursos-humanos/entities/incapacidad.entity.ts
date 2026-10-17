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
 * Registro administrativo de un periodo de incapacidad de un colaborador.
 * Solo modela el intervalo y notas administrativas; no guarda información médica.
 */
@Entity('Incapacidad')
@Index('IX_Incapacidad_colaboradorId', ['colaboradorId'])
@Index('IX_Incapacidad_fechas', ['fechaInicio', 'fechaFin'])
export class Incapacidad {
  @ApiProperty({
    example: 1,
    description: 'Identificador único de la incapacidad',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 3,
    description: 'Colaborador al que pertenece la incapacidad',
  })
  @Column({ type: 'int' })
  colaboradorId: number;

  @ManyToOne(() => Colaborador, (colaborador) => colaborador.incapacidades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'colaboradorId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_Incapacidad_Colaborador',
  })
  colaborador: Colaborador;

  @ApiProperty({
    example: '2026-10-12',
    description: 'Primer día del periodo de incapacidad (YYYY-MM-DD)',
  })
  // varchar(10) como en PermisoColaborador: evita el desfase de un día
  // que provoca el driver mssql al hidratar columnas DATE vía Date de JS.
  @Column({ type: 'varchar', length: 10 })
  fechaInicio: string;

  @ApiProperty({
    example: '2026-10-20',
    description: 'Último día del periodo de incapacidad (YYYY-MM-DD)',
  })
  @Column({ type: 'varchar', length: 10 })
  fechaFin: string;

  @ApiPropertyOptional({
    example: 'Documento entregado a administración',
    nullable: true,
    description: 'Notas administrativas del registro (sin información médica)',
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
    if (this.observaciones) {
      this.observaciones = this.observaciones.trim();
    } else if (this.observaciones === '') {
      this.observaciones = null;
    }
  }
}
