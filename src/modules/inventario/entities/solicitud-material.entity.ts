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
  EstadoSolicitudMaterial,
  isEstadoSolicitudMaterialValido,
} from '../../../common/enums/estado-solicitud-material.enum';
import { Averia } from '../../averias/entities/averia.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DetalleSolicitudMaterial } from './detalle-solicitud-material.entity';

/**
 * Entidad que modela una solicitud de materiales realizada por un Fontanero
 * dentro del módulo de Inventario para la ejecución de labores operativas o atención de averías.
 *
 * Características clave:
 * - Identifica al fontanero solicitante (Usuario).
 * - Registra la fecha y hora de la solicitud y su estado operativo (PENDIENTE, APROBADA, RECHAZADA).
 * - Se relaciona de forma 1:N con los ítems solicitados (DetalleSolicitudMaterial).
 * - Permite vinculación opcional con una Avería (idAveria nulo o asignado).
 * - Queda preparada para revisión, aprobación y seguimiento administrativo.
 * - Registrar la solicitud no modifica las existencias físicas de inventario.
 */
@Entity('SolicitudMaterial')
export class SolicitudMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Código de seguimiento o número amigable de la solicitud (ej. "SOL-0008").
   */
  @Index('IX_SolicitudMaterial_codigo')
  @Column({ type: 'varchar', length: 40, nullable: true })
  codigo: string | null;

  /**
   * Fecha y hora en la que el fontanero emite la solicitud de materiales.
   */
  @Index('IX_SolicitudMaterial_fechaSolicitud')
  @Column({ type: 'datetime' })
  fechaSolicitud: Date;

  /**
   * Estado actual de la solicitud: PENDIENTE, APROBADA o RECHAZADA.
   */
  @Index('IX_SolicitudMaterial_estado')
  @Column({
    type: 'varchar',
    length: 30,
    default: EstadoSolicitudMaterial.PENDIENTE,
  })
  estado: EstadoSolicitudMaterial;

  /**
   * Justificación, propósito o notas generales de la solicitud.
   */
  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  /**
   * Identificador del usuario Fontanero que realiza la solicitud.
   */
  @Index('IX_SolicitudMaterial_idFontanero')
  @Column({ type: 'int' })
  idFontanero: number;

  /**
   * Fontanero solicitante.
   */
  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({
    name: 'idFontanero',
    referencedColumnName: 'idUsuario',
  })
  fontanero: Usuario;

  /**
   * Identificador de la avería relacionada cuando la solicitud se origina
   * en la atención de una incidencia en la red de acueducto (opcional).
   */
  @Index('IX_SolicitudMaterial_idAveria')
  @Column({ type: 'int', nullable: true })
  idAveria: number | null;

  /**
   * Relación opcional con la entidad Avería.
   */
  @ManyToOne(() => Averia, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idAveria' })
  averia: Averia | null;

  /**
   * Lista detallada de materiales y cantidades solicitadas (relación 1:N).
   */
  @OneToMany(
    () => DetalleSolicitudMaterial,
    (detalle: DetalleSolicitudMaterial) => detalle.solicitud,
    {
      cascade: true,
    },
  )
  detalles: DetalleSolicitudMaterial[];

  /**
   * Usuario administrativo que revisó, aprobó o rechazó la solicitud (opcional/trazabilidad).
   */
  @Column({ type: 'int', nullable: true })
  idUsuarioAprobador: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'idUsuarioAprobador',
    referencedColumnName: 'idUsuario',
  })
  usuarioAprobador: Usuario | null;

  /**
   * Fecha y hora en la que se efectuó la revisión administrativa (aprobación/rechazo).
   */
  @Column({ type: 'datetime', nullable: true })
  fechaRevision: Date | null;

  /**
   * Justificación o motivo en caso de rechazo de la solicitud.
   */
  @Column({ type: 'text', nullable: true })
  motivoRechazo: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  asignarValoresIniciales(): void {
    if (!this.fechaSolicitud) {
      this.fechaSolicitud = new Date();
    }
    if (!this.estado) {
      this.estado = EstadoSolicitudMaterial.PENDIENTE;
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  validar(): void {
    if (this.estado !== undefined) {
      if (!isEstadoSolicitudMaterialValido(this.estado)) {
        throw new BadRequestException(
          `Estado de solicitud no válido: ${this.estado}. Estados permitidos: ${Object.values(
            EstadoSolicitudMaterial,
          ).join(', ')}`,
        );
      }
    }

    if (this.codigo !== undefined && this.codigo !== null) {
      const trimmed = this.codigo.trim();
      this.codigo = trimmed === '' ? null : trimmed;
    }

    if (this.observacion !== undefined && this.observacion !== null) {
      const trimmed = this.observacion.trim();
      this.observacion = trimmed === '' ? null : trimmed;
    }

    if (this.motivoRechazo !== undefined && this.motivoRechazo !== null) {
      const trimmed = this.motivoRechazo.trim();
      this.motivoRechazo = trimmed === '' ? null : trimmed;
    }
  }
}
