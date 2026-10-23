import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { TipoDocumentoSolicitud } from '../../../common/enums/tipo-documento-solicitud.enum';
import { Solicitud } from './solicitud.entity';

/**
 * Adjunto ciudadano de una solicitud digital.
 * Completa el stub `Solicitud.documentos` (Backlog solicitudes digitales).
 *
 * Flujo: upload público → fila con `solicitudId` nulo + `tokenReclamo`
 * → al registrar el trámite se reclama y se asocia a la Solicitud.
 */
@Entity('DocumentoSolicitud')
@Index('IX_DocumentoSolicitud_solicitudId', ['solicitudId'])
@Index('IX_DocumentoSolicitud_tokenReclamo', ['tokenReclamo'], { unique: true })
export class DocumentoSolicitud {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Null mientras el adjunto está pendiente de reclamo',
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  solicitudId?: number | null;

  @ApiProperty({
    example: TipoDocumentoSolicitud.IDENTIFICACION,
    enum: TipoDocumentoSolicitud,
  })
  @Column({ type: 'varchar', length: 40 })
  tipoDocumento: TipoDocumentoSolicitud;

  @ApiProperty({ example: 'cedula.pdf' })
  @Column({ type: 'varchar', length: 255 })
  nombreOriginal: string;

  @ApiProperty({ example: 'application/pdf' })
  @Column({ type: 'varchar', length: 100 })
  tipoArchivo: string;

  @ApiProperty({
    example: '/uploads/solicitudes/pendientes/….pdf',
  })
  @Column({ type: 'varchar', length: 500 })
  rutaReferenciaArchivo: string;

  @ApiProperty({ example: 245760 })
  @Column({ type: 'int' })
  tamanio: number;

  /**
   * Secreto de un solo uso para vincular el adjunto a la solicitud
   * (evita reutilizar documentId ajenos en formularios públicos).
   */
  @Column({ type: 'varchar', length: 64 })
  tokenReclamo: string;

  @ApiProperty()
  @CreateDateColumn()
  fechaCarga: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Solicitud, (solicitud) => solicitud.documentos, {
    onDelete: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn({ name: 'solicitudId' })
  solicitud?: Solicitud | null;
}
