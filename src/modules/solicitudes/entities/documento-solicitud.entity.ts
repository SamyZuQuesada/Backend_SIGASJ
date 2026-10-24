import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeforeInsert,
  BeforeUpdate,
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
 * Adjunto ciudadano de una solicitud digital con registro seguro de metadatos.
 * Cumple con Backlog 4.1.2:
 * - Cada archivo pertenece a una solicitud.
 * - Registra metadatos: tipoDocumento, nombreOriginal, nombreInterno, mimeType, tamano, ubicacion, fechaCarga.
 * - Los nombres internos son únicos y evitan colisiones en disco.
 * - El almacenamiento físico se realiza fuera de SQL Server (evitando columnas binarias pesadas).
 */
@Entity('DocumentoSolicitud')
@Index('IX_DocumentoSolicitud_solicitudId', ['solicitudId'])
@Index('IX_DocumentoSolicitud_tokenReclamo', ['tokenReclamo'], { unique: true })
@Index('IX_DocumentoSolicitud_nombreInterno', ['nombreInterno'])
export class DocumentoSolicitud {
  @ApiProperty({
    example: 1,
    description: 'Identificador único correlativo del documento',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'ID de la solicitud asociada (null mientras el adjunto está pendiente de reclamo)',
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  solicitudId?: number | null;

  @ApiProperty({
    example: TipoDocumentoSolicitud.IDENTIFICACION,
    enum: TipoDocumentoSolicitud,
    description: 'Tipo o clasificación del documento oficial exigido por el trámite',
  })
  @Column({ type: 'varchar', length: 40 })
  tipoDocumento: TipoDocumentoSolicitud;

  @ApiProperty({
    example: 'cedula_identidad.pdf',
    description: 'Nombre original del archivo proporcionado por el ciudadano',
  })
  @Column({ type: 'varchar', length: 255 })
  nombreOriginal: string;

  @ApiProperty({
    example: '1729789123456-a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf',
    description: 'Nombre interno único asignado para evitar colisiones en almacenamiento',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  nombreInterno: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'Tipo MIME oficial verificado del documento',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'MIME/tipo de archivo para compatibilidad',
  })
  @Column({ type: 'varchar', length: 100 })
  tipoArchivo: string;

  @ApiProperty({
    example: 245760,
    description: 'Tamaño del archivo en bytes',
  })
  @Column({ type: 'int', nullable: true })
  tamano: number;

  @ApiProperty({
    example: 245760,
    description: 'Tamaño del archivo en bytes para compatibilidad',
  })
  @Column({ type: 'int' })
  tamanio: number;

  @ApiProperty({
    example: '/uploads/solicitudes/pendientes/1729789123456-a1b2c3d4.pdf',
    description: 'Ubicación física o ruta relativa del archivo en almacenamiento seguro',
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  ubicacion: string;

  @ApiProperty({
    example: '/uploads/solicitudes/pendientes/1729789123456-a1b2c3d4.pdf',
    description: 'Ruta de referencia al archivo para compatibilidad',
  })
  @Column({ type: 'varchar', length: 500 })
  rutaReferenciaArchivo: string;

  /**
   * Secreto de un solo uso para vincular el adjunto a la solicitud
   * (evita reutilizar documentId ajenos en formularios públicos).
   */
  @Column({ type: 'varchar', length: 64 })
  tokenReclamo: string;

  @ApiProperty({
    description: 'Fecha y hora oficial de carga del documento',
  })
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

  @BeforeInsert()
  @BeforeUpdate()
  sincronizarMetadatos(): void {
    if (!this.nombreInterno && (this.rutaReferenciaArchivo || this.ubicacion)) {
      const ruta = this.rutaReferenciaArchivo || this.ubicacion;
      this.nombreInterno = ruta.split('/').pop()?.split('\\').pop() || '';
    }

    if (this.mimeType && !this.tipoArchivo) {
      this.tipoArchivo = this.mimeType;
    } else if (this.tipoArchivo && !this.mimeType) {
      this.mimeType = this.tipoArchivo;
    }

    if (this.tamano !== undefined && this.tamanio === undefined) {
      this.tamanio = this.tamano;
    } else if (this.tamanio !== undefined && this.tamano === undefined) {
      this.tamano = this.tamanio;
    }

    if (this.ubicacion && !this.rutaReferenciaArchivo) {
      this.rutaReferenciaArchivo = this.ubicacion;
    } else if (this.rutaReferenciaArchivo && !this.ubicacion) {
      this.ubicacion = this.rutaReferenciaArchivo;
    }
  }
}
