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
 *
 * Cada fila es un hecho inmutable: cuántos días se ACUMULARON o DISFRUTARON,
 * en qué fecha y por qué. El saldo disponible se calcula sumando el historial
 * (ACUMULADO - DISFRUTADO), por lo que nunca depende de editar un número a mano.
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
    description:
      'ACUMULADO suma días al saldo; DISFRUTADO los resta. Determina el signo del movimiento.',
  })
  @Column({ type: 'varchar', length: 20 })
  tipo: TipoMovimientoVacaciones;

  @ApiProperty({
    example: 5,
    minimum: 1,
    description:
      'Cantidad de días del movimiento. Siempre positiva; el signo lo da el tipo.',
  })
  @Column({ type: 'int' })
  cantidadDias: number;

  @ApiProperty({
    example: '2026-10-12',
    description: 'Fecha en que aplica el movimiento (YYYY-MM-DD)',
  })
  @Column({ type: 'date' })
  fecha: string;

  @ApiPropertyOptional({
    example: 'Vacaciones de fin de año',
    nullable: true,
    description: 'Observaciones del registro',
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

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
  }
}
