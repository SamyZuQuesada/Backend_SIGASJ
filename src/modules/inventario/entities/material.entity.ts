import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { CategoriaMaterial } from './categoria-material.entity';

/**
 * Entidad principal que representa los materiales administrados dentro de la bodega de la ASADA.
 * Almacena los datos básicos necesarios para su posterior utilización en entradas, salidas,
 * solicitudes, alertas de reposición, inventarios físicos y atención de averías.
 *
 * La existencia disponible (stockActual) no debe modificarse arbitrariamente mediante la edición
 * directa del material; los cambios de stock deberán provenir de operaciones autorizadas
 * (entradas, salidas, ajustes de inventario).
 */
@Entity('Material')
export class Material {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  /**
   * Unidad de medida para el control y despacho del artículo.
   * Ejemplos: "Unidad", "Metro", "Kilogramo", "Litro", "Pieza", "Rollo", "Tubo", etc.
   */
  @Column({ type: 'varchar', length: 50 })
  unidadMedida: string;

  /**
   * Ubicación física o referencia de estante / pasillo / bodega donde se almacena el artículo.
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  ubicacion: string | null;

  /**
   * Nivel de existencia mínimo permitido antes de detonar alertas de reposición o abastecimiento.
   */
  @Column({ type: 'int', default: 0 })
  stockMinimo: number;

  /**
   * Existencia física disponible en la bodega de la ASADA.
   * Este valor se gestiona exclusivamente a través de los movimientos de inventario.
   */
  @Column({ type: 'int', default: 0 })
  stockActual: number;

  /**
   * Indica si el material se encuentra activo para su uso y despacho operativo.
   */
  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'int', nullable: true })
  idCategoria?: number | null;

  @ManyToOne(() => CategoriaMaterial, (cat) => cat.materiales, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idCategoria' })
  categoria?: CategoriaMaterial | null;

  /* =========================================================================
   * PREPARACIÓN PARA FUTURAS RELACIONES (Backlog 4.3 y Movimientos):
   * =========================================================================
   *
   * // Backlog 4.3: Proveedor asignado o frecuente
   * @ManyToOne(() => Proveedor, { nullable: true })
   * @JoinColumn({ name: 'idProveedor' })
   * proveedor?: Proveedor | null;
   *
   * // Movimientos de inventario (Entradas y Salidas autorizadas)
   * @OneToMany(() => MovimientoInventario, (mov) => mov.material)
   * movimientos?: MovimientoInventario[];
   * ========================================================================= */

  /**
   * Validaciones de integridad básicas a nivel de entidad antes de persistir.
   */
  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.nombre !== undefined) {
      if (!this.nombre || !this.nombre.trim()) {
        throw new BadRequestException('El nombre del material es obligatorio');
      }
      this.nombre = this.nombre.trim();
    }

    if (this.unidadMedida !== undefined) {
      if (!this.unidadMedida || !this.unidadMedida.trim()) {
        throw new BadRequestException('La unidad de medida es obligatoria');
      }
      this.unidadMedida = this.unidadMedida.trim();
    }

    if (this.stockMinimo !== undefined && this.stockMinimo < 0) {
      throw new BadRequestException(
        'El stock mínimo no puede ser un número negativo',
      );
    }

    if (this.stockActual !== undefined && this.stockActual < 0) {
      throw new BadRequestException(
        'El stock actual no puede ser un número negativo',
      );
    }
  }
}
