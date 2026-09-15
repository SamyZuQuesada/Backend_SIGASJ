import { BadRequestException } from '@nestjs/common';
import {
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
import {
  EstadoAlertaReposicion,
  isEstadoAlertaReposicionValido,
} from '../../../common/enums/estado-alerta-reposicion.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Material } from './material.entity';

/**
 * Alerta de reposición generada cuando las existencias de un material
 * alcanzan o quedan por debajo de su stock mínimo.
 *
 * No duplica nombre, categoría ni unidad de medida: esos datos se consultan
 * a través de la relación con Material.
 */
@Entity('AlertaReposicion')
export class AlertaReposicion {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IX_AlertaReposicion_idMaterial')
  @Column({ type: 'int' })
  idMaterial: number;

  @ManyToOne(() => Material, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idMaterial' })
  material: Material;

  @Column({ type: 'int' })
  stockActual: number;

  @Column({ type: 'int' })
  stockMinimo: number;

  @Index('IX_AlertaReposicion_estado')
  @Column({
    type: 'varchar',
    length: 30,
    default: EstadoAlertaReposicion.PENDIENTE,
  })
  estado: EstadoAlertaReposicion;

  @Index('IX_AlertaReposicion_fechaGeneracion')
  @Column({ type: 'datetime' })
  fechaGeneracion: Date;

  @Column({ type: 'int', nullable: true })
  idUsuarioGestiona: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'idUsuarioGestiona',
    referencedColumnName: 'idUsuario',
  })
  usuarioGestiona: Usuario | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  asignarValoresIniciales(): void {
    if (!this.fechaGeneracion) {
      this.fechaGeneracion = new Date();
    }
    if (!this.estado) {
      this.estado = EstadoAlertaReposicion.PENDIENTE;
    }
    if (this.idUsuarioGestiona === undefined) {
      this.idUsuarioGestiona = null;
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.estado !== undefined && !isEstadoAlertaReposicionValido(this.estado)) {
      throw new BadRequestException(
        `Estado de alerta no válido: ${this.estado}. Estados permitidos: ${Object.values(
          EstadoAlertaReposicion,
        ).join(', ')}`,
      );
    }

    if (this.stockActual !== undefined) {
      if (
        typeof this.stockActual !== 'number' ||
        !Number.isInteger(this.stockActual) ||
        this.stockActual < 0
      ) {
        throw new BadRequestException(
          'El stock actual de la alerta debe ser un entero mayor o igual a cero',
        );
      }
    }

    if (this.stockMinimo !== undefined) {
      if (
        typeof this.stockMinimo !== 'number' ||
        !Number.isInteger(this.stockMinimo) ||
        this.stockMinimo < 0
      ) {
        throw new BadRequestException(
          'El stock mínimo de la alerta debe ser un entero mayor o igual a cero',
        );
      }
    }
  }
}
