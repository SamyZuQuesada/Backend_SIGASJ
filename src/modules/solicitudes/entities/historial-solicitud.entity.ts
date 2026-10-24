import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeforeInsert,
  BeforeRemove,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';
import { Solicitud } from './solicitud.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export const HISTORIAL_SOLICITUD_NO_MODIFICABLE =
  'El historial de una solicitud no se puede modificar.';
export const HISTORIAL_SOLICITUD_NO_ELIMINABLE =
  'El historial de una solicitud no se puede eliminar.';

/**
 * Traza inmutable de auditoría y ciclo de vida de una solicitud digital.
 * Registra cada cambio de estado, eventos automáticos (registro inicial, etc.)
 * y acciones administrativas preservando la integridad histórica.
 */
@Entity('HistorialSolicitud')
@Index('IX_HistorialSolicitud_solicitudId_fechaHora', [
  'solicitudId',
  'fechaHora',
])
@Index('IX_HistorialSolicitud_solicitudId', ['solicitudId'])
export class HistorialSolicitud {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del registro de historial',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 10,
    description: 'ID de la solicitud a la que pertenece este evento de historial',
  })
  @Column({ type: 'int' })
  solicitudId: number;

  @ManyToOne(() => Solicitud, (solicitud) => solicitud.historial, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'solicitudId' })
  solicitud: Solicitud;

  @ApiProperty({
    example: 'REGISTRADA',
    description: 'Tipo o nombre del evento dentro del ciclo de vida',
  })
  @Column({ type: 'varchar', length: 50, default: 'REGISTRADA' })
  evento: string;

  @ApiPropertyOptional({
    example: 'CREACION',
    description: 'Clasificación técnica del evento',
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  tipoEvento?: string | null;

  @ApiProperty({
    example: 'Solicitud registrada en el sistema',
    description: 'Descripción detallada o motivo del evento en el historial',
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string;

  get comentario(): string | undefined {
    return this.descripcion;
  }

  set comentario(value: string | undefined) {
    if (value !== undefined) {
      this.descripcion = value;
    }
  }

  @ApiPropertyOptional({
    enum: EstadoSolicitud,
    example: null,
    description: 'Estado anterior de la solicitud antes de este evento',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  estadoAnterior?: EstadoSolicitud | null;

  @ApiProperty({
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
    description: 'Estado resultante de la solicitud tras este evento',
    default: EstadoSolicitud.PENDIENTE,
  })
  @Column({ type: 'varchar', length: 30, default: EstadoSolicitud.PENDIENTE })
  estadoNuevo: EstadoSolicitud;

  @ApiPropertyOptional({
    example: null,
    description:
      'ID del usuario administrativo responsable (null si fue generada por el ciudadano)',
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  idUsuario?: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'idUsuario' })
  usuario?: Usuario | null;

  @ApiProperty({
    description: 'Fecha y hora en que ocurrió el evento',
  })
  @CreateDateColumn({ type: 'datetime' })
  fechaHora: Date;

  @BeforeInsert()
  fijarFechaHora(): void {
    if (!this.fechaHora) {
      this.fechaHora = new Date();
    }
    if (!this.evento) {
      this.evento = 'REGISTRADA';
    }
    if (!this.estadoNuevo) {
      this.estadoNuevo = EstadoSolicitud.PENDIENTE;
    }
  }

  @BeforeUpdate()
  impedirModificacion(): void {
    throw new Error(HISTORIAL_SOLICITUD_NO_MODIFICABLE);
  }

  @BeforeRemove()
  impedirEliminacion(): void {
    throw new Error(HISTORIAL_SOLICITUD_NO_ELIMINABLE);
  }
}
