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
import { ReposicionMaterial } from './reposicion-material.entity';

/**
 * Material y cantidad requeridos en una reposición.
 * No duplica nombre ni unidad de medida: se consultan vía Material.
 * Registrar el detalle no modifica el stock físico.
 */
@Entity('DetalleReposicionMaterial')
export class DetalleReposicionMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IX_DetalleReposicionMaterial_idReposicion')
  @Column({ type: 'int' })
  idReposicion: number;

  @ManyToOne(
    () => ReposicionMaterial,
    (reposicion: ReposicionMaterial) => reposicion.detalles,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'idReposicion' })
  reposicion: ReposicionMaterial;

  @Index('IX_DetalleReposicionMaterial_idMaterial')
  @Column({ type: 'int' })
  idMaterial: number;

  @ManyToOne(() => Material, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idMaterial' })
  material: Material;

  @Column({ type: 'int' })
  cantidad: number;

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
          'La cantidad de reposición debe ser un número entero',
        );
      }
      if (this.cantidad <= 0) {
        throw new BadRequestException(
          'La cantidad de reposición debe ser mayor a cero',
        );
      }
    }

    if (this.observacion !== undefined && this.observacion !== null) {
      const trimmed = this.observacion.trim();
      this.observacion = trimmed === '' ? null : trimmed;
    }
  }
}
