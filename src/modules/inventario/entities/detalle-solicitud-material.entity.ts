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
import { Material } from './material.entity';
import { SolicitudMaterial } from './solicitud-material.entity';

/**
 * Entidad que representa cada ítem o material específico incluido en una
 * Solicitud de Materiales realizada por un fontanero.
 *
 * Permite la relación 1:N (SolicitudMaterial -> DetalleSolicitudMaterial)
 * y N:1 (DetalleSolicitudMaterial -> Material).
 *
 * Importante: Registrar un detalle de solicitud NO decrementa ni altera
 * el stock físico del material en inventario.
 */
@Entity('DetalleSolicitudMaterial')
export class DetalleSolicitudMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Identificador de la solicitud cabecera a la que pertenece este renglón.
   */
  @Index('IX_DetalleSolicitudMaterial_idSolicitud')
  @Column({ type: 'int' })
  idSolicitud: number;

  @ManyToOne(
    () => SolicitudMaterial,
    (sol: SolicitudMaterial) => sol.detalles,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'idSolicitud' })
  solicitud: SolicitudMaterial;

  /**
   * Identificador del material solicitado del catálogo de inventario.
   */
  @Index('IX_DetalleSolicitudMaterial_idMaterial')
  @Column({ type: 'int' })
  idMaterial: number;

  @ManyToOne(() => Material, (mat) => mat.detallesSolicitud, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idMaterial' })
  material: Material;

  /**
   * Cantidad requerida del material. Debe ser un entero estrictamente mayor a cero.
   */
  @Column({ type: 'int' })
  cantidad: number;

  /**
   * Nota u observación específica sobre este material en particular (opcional).
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  observacion: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.cantidad !== undefined) {
      if (
        typeof this.cantidad !== 'number' ||
        !Number.isInteger(this.cantidad)
      ) {
        throw new BadRequestException(
          'La cantidad solicitada debe ser un número entero',
        );
      }
      if (this.cantidad <= 0) {
        throw new BadRequestException(
          'La cantidad solicitada debe ser mayor a cero',
        );
      }
    }

    if (this.observacion !== undefined && this.observacion !== null) {
      const trimmed = this.observacion.trim();
      this.observacion = trimmed === '' ? null : trimmed;
    }
  }
}
