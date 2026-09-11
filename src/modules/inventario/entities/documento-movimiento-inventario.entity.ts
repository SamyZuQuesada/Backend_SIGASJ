import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MovimientoInventario } from './movimiento-inventario.entity';

/**
 * Entidad que almacena los metadatos y la ruta de referencia de los documentos de respaldo
 * asociados a un movimiento de inventario (por ejemplo, facturas, recibos, guías de entrega, comprobantes).
 *
 * Los documentos quedan vinculados directamente al movimiento (MovimientoInventario)
 * y no al material, conservando la trazabilidad de la adquisición o despacho.
 */
@Entity('DocumentoMovimientoInventario')
export class DocumentoMovimientoInventario {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Nombre original del archivo proporcionado por el usuario (ej: factura_compra_2026.pdf)
   */
  @Column({ type: 'varchar', length: 255 })
  nombreOriginal: string;

  /**
   * Tipo MIME del archivo (ej: application/pdf, image/jpeg, image/png, image/webp)
   */
  @Column({ type: 'varchar', length: 100 })
  tipoArchivo: string;

  /**
   * Ruta relativa o referencia segura del archivo almacenado
   */
  @Column({ type: 'varchar', length: 500 })
  rutaReferenciaArchivo: string;

  /**
   * Tamaño del archivo en bytes
   */
  @Column({ type: 'int' })
  tamanio: number;

  /**
   * Identificador del movimiento de inventario asociado
   */
  @Index('IX_DocumentoMovimientoInventario_idMovimiento')
  @Column({ type: 'int' })
  idMovimiento: number;

  /**
   * Movimiento de inventario al que pertenece este documento de respaldo.
   * Si el movimiento se elimina, sus documentos se eliminan en cascada.
   */
  @ManyToOne(() => MovimientoInventario, (mov) => mov.documentos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idMovimiento' })
  movimiento: MovimientoInventario;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
