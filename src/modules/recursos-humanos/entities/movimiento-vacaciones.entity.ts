import { BadRequestException } from '@nestjs/common';
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
} from 'typeorm';
import {
  TIPOS_MOVIMIENTO_VACACIONES,
  TipoMovimientoVacaciones,
} from '../../../common/enums/tipo-movimiento-vacaciones.enum';
import { aFechaIso } from '../fecha-permiso';
import { Colaborador } from './colaborador.entity';

/**
 * Movimiento del historial de vacaciones de un colaborador.
 * ACUMULADO / DISFRUTADO / AJUSTE (± vía signoAjuste). Saldo derivado.
 */
@Entity('MovimientoVacaciones')
@Index('IX_MovimientoVacaciones_colaboradorId', ['colaboradorId'])
@Index('IX_MovimientoVacaciones_colaborador_fecha', ['colaboradorId', 'fecha'])
export class MovimientoVacaciones {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del movimiento',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 3,
    description: 'Colaborador al que pertenece el movimiento',
  })
  @Column({ type: 'int' })
  colaboradorId: number;

  @ManyToOne(
    () => Colaborador,
    (colaborador) => colaborador.movimientosVacaciones,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'colaboradorId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_MovimientoVacaciones_Colaborador',
  })
  colaborador: Colaborador;

  @ApiProperty({
    enum: TipoMovimientoVacaciones,
    example: TipoMovimientoVacaciones.ACUMULADO,
  })
  @Column({ type: 'varchar', length: 20 })
  tipo: TipoMovimientoVacaciones;

  @ApiProperty({
    example: 5,
    minimum: 1,
    description: 'Cantidad positiva; el signo lo da el tipo o signoAjuste.',
  })
  @Column({ type: 'int' })
  cantidadDias: number;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description: 'Solo AJUSTE: 1 suma, -1 resta',
  })
  @Column({ type: 'int', nullable: true })
  signoAjuste: 1 | -1 | null;

  @ApiProperty({
    example: '2026-10-12',
    description: 'Fecha en que aplica el movimiento (YYYY-MM-DD)',
  })
  @Column({ type: 'varchar', length: 10 })
  fecha: string;

  @ApiPropertyOptional({
    example: 'Vacaciones de fin de año',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description: 'idUsuario que registró el movimiento',
  })
  @Column({ type: 'int', nullable: true })
  registradoPorUsuarioId: number | null;

  @ApiProperty({
    description: 'Fecha y hora en que se registró el movimiento',
  })
  @CreateDateColumn()
  createdAt: Date;

  @AfterLoad()
  hidratarFecha(): void {
    if (this.fecha) {
      this.fecha = aFechaIso(this.fecha);
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    if (this.fecha) {
      this.fecha = aFechaIso(this.fecha);
    }
    if (this.observaciones) {
      this.observaciones = this.observaciones.trim();
    } else if (this.observaciones === '') {
      this.observaciones = null;
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (
      this.tipo !== undefined &&
      !TIPOS_MOVIMIENTO_VACACIONES.includes(this.tipo)
    ) {
      throw new BadRequestException(
        `El tipo de movimiento debe ser ${TIPOS_MOVIMIENTO_VACACIONES.join(' o ')}`,
      );
    }

    if (this.cantidadDias !== undefined) {
      if (
        typeof this.cantidadDias !== 'number' ||
        !Number.isInteger(this.cantidadDias)
      ) {
        throw new BadRequestException(
          'La cantidad de días debe ser un número entero',
        );
      }
      if (this.cantidadDias <= 0) {
        throw new BadRequestException(
          'La cantidad de días debe ser mayor a cero',
        );
      }
    }

    if (this.tipo === TipoMovimientoVacaciones.AJUSTE) {
      if (this.signoAjuste !== 1 && this.signoAjuste !== -1) {
        throw new BadRequestException(
          'Un AJUSTE requiere signoAjuste 1 (suma) o -1 (resta)',
        );
      }
      if (!this.observaciones?.trim()) {
        throw new BadRequestException(
          'Un AJUSTE requiere motivo en observaciones',
        );
      }
    } else if (this.signoAjuste != null) {
      throw new BadRequestException('signoAjuste solo aplica al tipo AJUSTE');
    }
  }
}
