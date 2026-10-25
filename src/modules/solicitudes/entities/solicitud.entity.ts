import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AfterLoad,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';
import {
  formatearCodigoSeguimiento,
  normalizarCodigoSeguimiento,
} from '../utils/codigo-seguimiento.util';
import { DocumentoSolicitud } from './documento-solicitud.entity';
import { HistorialSolicitud } from './historial-solicitud.entity';
import { TipoSolicitud } from './tipo-solicitud.entity';
import { SolicitudAfiliacion } from './solicitud-afiliacion.entity';
import { SolicitudArregloPago } from './solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './solicitud-cambio-titular.entity';
import { SolicitudDisponibilidadServicios } from './solicitud-disponibilidad-servicios.entity';
import { SolicitudInfraestructuraLinderos } from './solicitud-infraestructura-linderos.entity';
import { SolicitudConstanciaServicio } from './solicitud-constancia-servicio.entity';

/**
 * Entidad principal (encabezado común) para cualquier trámite o solicitud digital en SIGASJ.
 * Centraliza la información compartida de todos los trámites oficiales, mientras que
 * los datos específicos de cada uno de los 6 formularios se vinculan a través de sus
 * respectivas entidades de detalle.
 */
@Entity('Solicitud')
@Index('UQ_Solicitud_codigoSeguimiento', ['codigoSeguimiento'], {
  unique: true,
})
@Index('IX_Solicitud_tipoSolicitudId', ['tipoSolicitudId'])
@Index('IX_Solicitud_estado', ['estado'])
@Index('IX_Solicitud_fechaIngreso', ['fechaIngreso'])
export class Solicitud {
  @ApiProperty({
    example: 1,
    description: 'Identificador único correlativo de la solicitud',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description:
      'Identificador del tipo de trámite oficial al que pertenece la solicitud',
  })
  @Column({ type: 'int' })
  tipoSolicitudId: number;

  @ManyToOne(() => TipoSolicitud, (tipo) => tipo.solicitudes, {
    onDelete: 'RESTRICT', // Las solicitudes históricas no se eliminan al inactivar o modificar un tipo
  })
  @JoinColumn({
    name: 'tipoSolicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_Solicitud_TipoSolicitud',
  })
  tipoSolicitud: TipoSolicitud;

  @ApiProperty({
    example: 'SOL-2026-A82K91',
    description:
      'Código alfanumérico único para el seguimiento público del avance del trámite (Card 8)',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50, unique: true, update: false })
  codigoSeguimiento: string;

  @ApiProperty({
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
    description: 'Estado actual dentro del ciclo de vida de la solicitud',
    default: EstadoSolicitud.PENDIENTE,
  })
  @Column({
    type: 'varchar',
    length: 30,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  @ApiProperty({
    example: '2026-10-20T10:30:00.000Z',
    description:
      'Fecha y hora oficial en que el ciudadano ingresó la solicitud',
  })
  @Column({ type: 'datetime' })
  fechaIngreso: Date;

  @ApiPropertyOptional({
    description:
      'Fecha de baja lógica. Evita la eliminación física de solicitudes procesadas para resguardo histórico y de auditoría.',
    nullable: true,
  })
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;

  @ApiProperty({
    description: 'Fecha y hora de creación del registro en base de datos',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última actualización del registro',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  /* =========================================================================
   * RELACIÓN CON DOCUMENTOS E HISTORIAL:
   * =========================================================================
   * Adjuntos ciudadanos (DocumentoSolicitud) y trazabilidad de estados
   * (HistorialSolicitud: estado anterior/nuevo, observación pública, nota interna).
   * ========================================================================= */
  @OneToMany(() => DocumentoSolicitud, (documento) => documento.solicitud)
  documentos?: DocumentoSolicitud[];

  @OneToMany(() => HistorialSolicitud, (historial) => historial.solicitud, {
    cascade: true,
  })
  historial?: HistorialSolicitud[];

  /* =========================================================================
   * PREPARACIÓN DE RELACIONES CON DETALLES DE LOS SEIS FORMULARIOS OFICIALES:
   * =========================================================================
   * 1. Solicitud de Arreglo de Pago Domiciliar
   * 2. Cambio de Nombre del Titular del Servicio
   * 3. Constancia de Infraestructura Frente a Linderos de un Inmueble
   * 4. Solicitud de Afiliación
   * 5. Constancia de Disponibilidad de Servicios
   * 6. Constancia de Servicio Existente
   * ========================================================================= */
  @OneToOne(
    () => SolicitudArregloPago,
    (arregloPago) => arregloPago.solicitud,
    { cascade: true },
  )
  detalleArregloPago?: SolicitudArregloPago;

  @OneToOne(
    () => SolicitudCambioTitular,
    (cambioTitular) => cambioTitular.solicitud,
    { cascade: true },
  )
  detalleCambioTitular?: SolicitudCambioTitular;

  @OneToOne(
    () => SolicitudInfraestructuraLinderos,
    (infra) => infra.solicitud,
    { cascade: true },
  )
  detalleInfraestructuraLinderos?: SolicitudInfraestructuraLinderos;

  @OneToOne(() => SolicitudAfiliacion, (afiliacion) => afiliacion.solicitud, {
    cascade: true,
  })
  detalleAfiliacion?: SolicitudAfiliacion;

  @OneToOne(
    () => SolicitudDisponibilidadServicios,
    (disponibilidad) => disponibilidad.solicitud,
    { cascade: true },
  )
  detalleDisponibilidadServicios?: SolicitudDisponibilidadServicios;

  @OneToOne(
    () => SolicitudConstanciaServicio,
    (constancia) => constancia.solicitud,
    { cascade: true },
  )
  detalleConstanciaServicio?: SolicitudConstanciaServicio;

  get detalleServicioExistente(): SolicitudConstanciaServicio | undefined {
    return this.detalleConstanciaServicio;
  }

  set detalleServicioExistente(value: SolicitudConstanciaServicio | undefined) {
    this.detalleConstanciaServicio = value;
  }

  private _codigoSeguimientoOriginal?: string;

  @AfterLoad()
  capturarCodigoOriginal(): void {
    this._codigoSeguimientoOriginal = this.codigoSeguimiento;
  }

  @BeforeInsert()
  establecerValoresPorDefecto(): void {
    if (!this.estado) {
      this.estado = EstadoSolicitud.PENDIENTE;
    }
    if (!this.fechaIngreso) {
      this.fechaIngreso = new Date();
    }
    if (this.codigoSeguimiento) {
      this.codigoSeguimiento = normalizarCodigoSeguimiento(
        this.codigoSeguimiento,
      );
    } else {
      const year =
        this.fechaIngreso?.getFullYear?.() || new Date().getFullYear();
      this.codigoSeguimiento = formatearCodigoSeguimiento(year);
    }
    this._codigoSeguimientoOriginal = this.codigoSeguimiento;
  }

  @BeforeUpdate()
  validarInmutabilidadCodigo(): void {
    if (
      this._codigoSeguimientoOriginal &&
      this.codigoSeguimiento &&
      normalizarCodigoSeguimiento(this.codigoSeguimiento) !==
        normalizarCodigoSeguimiento(this._codigoSeguimientoOriginal)
    ) {
      throw new BadRequestException(
        'El código de seguimiento de una solicitud es inmutable y no puede ser modificado',
      );
    }
  }
}

