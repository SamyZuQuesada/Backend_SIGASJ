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
 * Entidad principal que representa a los proveedores de la ASADA.
 * Almacena la información de identificación, contacto y estado operativo
 * de personas físicas o jurídicas que suministran materiales para compra,
 * reposición y mantenimiento de redes e instalaciones de agua potable.
 *
 * Para garantizar la integridad histórica de compras y materiales previamente
 * abastecidos, los proveedores no se eliminan físicamente; se inactivan lógicamente
 * a través de la propiedad `activo`.
 */
@Entity('Proveedor')
export class Proveedor {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Nombre comercial o razón social principal del proveedor.
   */
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  /**
   * Razón social jurídica o nombre legal completo (cuando aplique).
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  razonSocial: string | null;

  /**
   * Identificación legal del proveedor (cédula física, cédula jurídica o DIMEX).
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  identificacion: string | null;

  /**
   * Teléfono de contacto de la empresa o sucursal proveedora.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono: string | null;

  /**
   * Correo electrónico para cotizaciones, facturas y comunicaciones operativas.
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  correo: string | null;

  /**
   * Dirección física o domicilio del proveedor.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  direccion: string | null;

  /**
   * Nombre o cargo de la persona de contacto directo / ejecutivo de cuenta.
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  personaContacto: string | null;

  /**
   * Estado operativo del proveedor (activo / inactivo).
   * Se utiliza para dar de baja lógica al proveedor sin romper relaciones históricas.
   */
  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Materiales asociados o frecuentemente suministrados por este proveedor.
   */
  @OneToMany(() => Material, (material) => material.proveedor)
  materiales?: Material[];

  /* =========================================================================
   * PREPARACIÓN PARA PROCESOS DE COMPRA Y REPOSICIÓN:
   * =========================================================================
   * // Futura relación con Compras / Órdenes de Reposición (Backlog Compras):
   * // @OneToMany(() => Compra, (compra) => compra.proveedor)
   * // compras?: Compra[];
   * ========================================================================= */

  /**
   * Validaciones de integridad básicas a nivel de entidad antes de persistir o actualizar.
   */
  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.nombre !== undefined) {
      if (!this.nombre || !this.nombre.trim()) {
        throw new BadRequestException(
          'El nombre o razón social del proveedor es obligatorio',
        );
      }
      this.nombre = this.nombre.trim();
    }

    if (this.razonSocial !== undefined && this.razonSocial !== null) {
      this.razonSocial = this.razonSocial.trim() || null;
    }

    if (this.identificacion !== undefined && this.identificacion !== null) {
      this.identificacion = this.identificacion.trim() || null;
    }

    if (this.telefono !== undefined && this.telefono !== null) {
      this.telefono = this.telefono.trim() || null;
    }

    if (this.personaContacto !== undefined && this.personaContacto !== null) {
      this.personaContacto = this.personaContacto.trim() || null;
    }

    if (this.direccion !== undefined && this.direccion !== null) {
      this.direccion = this.direccion.trim() || null;
    }

    if (this.correo !== undefined && this.correo !== null) {
      const emailTrimmed = this.correo.trim();
      if (emailTrimmed.length > 0) {
        // Validación básica de formato de correo electrónico
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed)) {
          throw new BadRequestException(
            'El formato del correo electrónico es inválido',
          );
        }
        this.correo = emailTrimmed.toLowerCase();
      } else {
        this.correo = null;
      }
    }
  }
}
