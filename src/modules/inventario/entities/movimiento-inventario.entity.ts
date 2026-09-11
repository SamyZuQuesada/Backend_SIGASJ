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
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoMovimientoInventario } from '../../../common/enums/tipo-movimiento-inventario.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Material } from './material.entity';
import { Proveedor } from './proveedor.entity';
import { DocumentoMovimientoInventario } from './documento-movimiento-inventario.entity';

/**
 * Entidad que registra y conserva la trazabilidad histórica de todas las operaciones
 * que aumentan o disminuyen las existencias de materiales en la bodega de la ASADA.
 *
 * Se reutiliza la misma entidad y tabla tanto para ENTRADA como para SALIDA,
 * garantizando una auditoría unificada de:
 * - QUÉ material se movió (idMaterial)
 * - CUÁL operación se ejecutó (tipo: ENTRADA / SALIDA)
 * - CUÁNTAS unidades se operaron (cantidad > 0)
 * - CUÁNDO ocurrió físicamente el movimiento (fechaMovimiento) y cuándo se registró (createdAt)
 * - QUIÉN fue el usuario responsable (idUsuario)
 * - POR QUÉ ocurrió (observacion o motivo)
 * - A QUIÉN se adquirió en caso de compras (idProveedor opcional)
 * - A CUÁL proceso operativo se vincula en caso de salidas (idAveria, idSolicitud, idProyecto opcionales)
 */
@Entity('MovimientoInventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Tipo de movimiento: ENTRADA (incremento) o SALIDA (decremento).
   */
  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo: TipoMovimientoInventario;

  /**
   * Cantidad física de unidades operadas. Debe ser estrictamente mayor a cero.
   * El signo de la operación está determinado por el campo `tipo`.
   */
  @Column({ type: 'int' })
  cantidad: number;

  /**
   * Fecha y hora en la que se realizó físicamente la entrada o salida de bodega.
   */
  @Index('IX_MovimientoInventario_fechaMovimiento')
  @Column({ type: 'datetime' })
  fechaMovimiento: Date;

  /**
   * Justificación, motivo u observaciones adicionales sobre la operación realizada.
   */
  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  /**
   * Identificador del material afectado en bodega.
   */
  @Index('IX_MovimientoInventario_idMaterial')
  @Column({ type: 'int' })
  idMaterial: number;

  /**
   * Material relacionado cuyo stock es alterado por el movimiento.
   */
  @ManyToOne(() => Material, (mat) => mat.movimientos, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idMaterial' })
  material: Material;

  /**
   * Identificador del usuario que autorizó o ejecutó el movimiento de bodega.
   */
  @Index('IX_MovimientoInventario_idUsuario')
  @Column({ type: 'int' })
  idUsuario: number;

  /**
   * Usuario responsable de la operación (ej. Administradora en compras, Fontanero en despachos de averías).
   */
  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idUsuario' })
  usuario: Usuario;

  /**
   * Identificador del proveedor asociado (opcional, aplicable principalmente en ENTRADAS por compra o recepción).
   */
  @Column({ type: 'int', nullable: true })
  idProveedor?: number | null;

  /**
   * Proveedor suministrante cuando aplique.
   */
  @ManyToOne(() => Proveedor, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idProveedor' })
  proveedor?: Proveedor | null;

  /**
   * Referencia opcional a una Avería (aplicable en SALIDAS para atención de fugas y averías en red).
   */
  @Column({ type: 'int', nullable: true })
  idAveria?: number | null;

  /**
   * Referencia opcional a una Solicitud (aplicable en SALIDAS para nuevas conexiones o servicios).
   */
  @Column({ type: 'int', nullable: true })
  idSolicitud?: number | null;

  /**
   * Referencia opcional a un Proyecto comunitario o de infraestructura de la ASADA.
   */
  @Column({ type: 'int', nullable: true })
  idProyecto?: number | null;

  /**
   * Documentos de respaldo adjuntos a este movimiento (facturas, comprobantes, etc.)
   */
  @OneToMany(() => DocumentoMovimientoInventario, (doc) => doc.movimiento)
  documentos?: DocumentoMovimientoInventario[];

  /**
   * Fecha y hora exacta de registro cronológico del movimiento en la base de datos.
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Validaciones de integridad a nivel de entidad antes de persistir o actualizar.
   */
  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.tipo !== undefined) {
      if (
        this.tipo !== TipoMovimientoInventario.ENTRADA &&
        this.tipo !== TipoMovimientoInventario.SALIDA
      ) {
        throw new BadRequestException(
          `El tipo de movimiento debe ser ${TipoMovimientoInventario.ENTRADA} o ${TipoMovimientoInventario.SALIDA}`,
        );
      }
    }

    if (this.cantidad !== undefined) {
      if (typeof this.cantidad !== 'number' || !Number.isInteger(this.cantidad)) {
        throw new BadRequestException(
          'La cantidad del movimiento debe ser un número entero',
        );
      }
      if (this.cantidad <= 0) {
        throw new BadRequestException(
          'La cantidad del movimiento debe ser mayor a cero',
        );
      }
    }

    if (!this.fechaMovimiento) {
      this.fechaMovimiento = new Date();
    }

    if (this.observacion !== undefined && this.observacion !== null) {
      const trimmed = this.observacion.trim();
      this.observacion = trimmed === '' ? null : trimmed;
    }
  }
}
