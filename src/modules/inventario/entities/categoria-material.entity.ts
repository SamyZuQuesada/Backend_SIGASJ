import { BadRequestException } from '@nestjs/common';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Material } from './material.entity';

/**
 * Entidad que representa las categorías utilizadas para agrupar y clasificar
 * los materiales de bodega de la ASADA según su tipo o naturaleza
 * (ej. "Tuberías", "Accesorios", "Válvulas", "Herramientas").
 */
@Entity('CategoriaMaterial')
export class CategoriaMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  /**
   * Estado operativo de la categoría. Permite desactivarla lógicamente
   * para no romper el historial de materiales vinculados previamente.
   */
  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Colección de materiales clasificados bajo esta categoría.
   */
  @OneToMany(() => Material, (material) => material.categoria)
  materiales?: Material[];

  /**
   * Validaciones de integridad antes de persistir o actualizar.
   */
  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.nombre !== undefined) {
      if (!this.nombre || !this.nombre.trim()) {
        throw new BadRequestException(
          'El nombre de la categoría es obligatorio',
        );
      }
      this.nombre = this.nombre.trim();
    }
  }
}
