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
  UpdateDateColumn,
} from 'typeorm';
import {
  EstadoReposicionMaterial,
  isEstadoReposicionMaterialValido,
} from '../../../common/enums/estado-reposicion-material.enum';
import {
  OrigenReposicionMaterial,
  isOrigenReposicionMaterialValido,
} from '../../../common/enums/origen-reposicion-material.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { AlertaReposicion } from './alerta-reposicion.entity';
import { DetalleReposicionMaterial } from './detalle-reposicion-material.entity';
import { Proveedor } from './proveedor.entity';
import { SolicitudMaterial } from './solicitud-material.entity';

/**
 * Necesidad de reposición de materiales detectada en inventario.
 * Puede originarse en una alerta de stock mínimo, una solicitud aprobada
 * u otra gestión administrativa. Queda preparada para registrar la compra
 * (proveedor y fecha) y la posterior recepción, sin duplicar el catálogo.
 */
@Entity('ReposicionMaterial')
export class ReposicionMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IX_ReposicionMaterial_codigo')
  @Column({ type: 'varchar', length: 40, nullable: true })
  codigo: string | null;

  @Index('IX_ReposicionMaterial_fechaGeneracion')
  @Column({ type: 'datetime' })
  fechaGeneracion: Date;

  @Index('IX_ReposicionMaterial_origen')
  @Column({ type: 'varchar', length: 40 })
  origen: OrigenReposicionMaterial;

  @Index('IX_ReposicionMaterial_estado')
  @Column({
    type: 'varchar',
    length: 30,
    default: EstadoReposicionMaterial.PENDIENTE,
  })
  estado: EstadoReposicionMaterial;

  @Column({ type: 'int', nullable: true })
  idAlertaReposicion: number | null;

  @ManyToOne(() => AlertaReposicion, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idAlertaReposicion' })
  alertaReposicion: AlertaReposicion | null;

  @Column({ type: 'int', nullable: true })
  idSolicitudMaterial: number | null;

  @ManyToOne(() => SolicitudMaterial, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idSolicitudMaterial' })
  solicitudMaterial: SolicitudMaterial | null;

  @Index('IX_ReposicionMaterial_idUsuarioResponsable')
  @Column({ type: 'int' })
  idUsuarioResponsable: number;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({
    name: 'idUsuarioResponsable',
    referencedColumnName: 'idUsuario',
  })
  usuarioResponsable: Usuario;

  @Column({ type: 'int', nullable: true })
  idProveedor: number | null;

  @ManyToOne(() => Proveedor, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idProveedor' })
  proveedor: Proveedor | null;

  @Column({ type: 'datetime', nullable: true })
  fechaCompra: Date | null;

  @Column({ type: 'datetime', nullable: true })
  fechaRecepcion: Date | null;

  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  @OneToMany(
    () => DetalleReposicionMaterial,
    (detalle: DetalleReposicionMaterial) => detalle.reposicion,
    { cascade: true },
  )
  detalles: DetalleReposicionMaterial[];

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
      this.estado = EstadoReposicionMaterial.PENDIENTE;
    }
    if (this.codigo === undefined) {
      this.codigo = null;
    }
    if (this.idAlertaReposicion === undefined) {
      this.idAlertaReposicion = null;
    }
    if (this.idSolicitudMaterial === undefined) {
      this.idSolicitudMaterial = null;
    }
    if (this.idProveedor === undefined) {
      this.idProveedor = null;
    }
    if (this.fechaCompra === undefined) {
      this.fechaCompra = null;
    }
    if (this.fechaRecepcion === undefined) {
      this.fechaRecepcion = null;
    }
    if (this.observacion === undefined) {
      this.observacion = null;
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.estado !== undefined && !isEstadoReposicionMaterialValido(this.estado)) {
      throw new BadRequestException(
        `Estado de reposición no válido: ${this.estado}. Estados permitidos: ${Object.values(
          EstadoReposicionMaterial,
        ).join(', ')}`,
      );
    }

    if (this.origen !== undefined && !isOrigenReposicionMaterialValido(this.origen)) {
      throw new BadRequestException(
        `Origen de reposición no válido: ${this.origen}. Orígenes permitidos: ${Object.values(
          OrigenReposicionMaterial,
        ).join(', ')}`,
      );
    }

    if (this.codigo !== undefined && this.codigo !== null) {
      const trimmed = this.codigo.trim();
      this.codigo = trimmed === '' ? null : trimmed;
    }

    if (this.observacion !== undefined && this.observacion !== null) {
      const trimmed = this.observacion.trim();
      this.observacion = trimmed === '' ? null : trimmed;
    }
  }
}
