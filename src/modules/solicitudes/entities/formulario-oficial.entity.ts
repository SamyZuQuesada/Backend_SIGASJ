import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoSolicitud } from './tipo-solicitud.entity';

/**
 * Entidad que almacena los metadatos y la referencia física al PDF oficial
 * vigente para cada uno de los trámites oficiales de la ASADA.
 *
 * Mantiene una relación 1:1 estricta con TipoSolicitud (máximo un formulario
 * oficial vigente por trámite).
 */
@Entity('FormularioOficial')
@Index('UQ_FormularioOficial_tipoSolicitudId', ['tipoSolicitudId'], {
  unique: true,
})
export class FormularioOficial {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del registro de formulario oficial',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description:
      'Identificador del tipo de trámite oficial al que pertenece el documento (1:1)',
  })
  @Column({ type: 'int', unique: true })
  tipoSolicitudId: number;

  @OneToOne(() => TipoSolicitud, (tipo) => tipo.formularioOficial, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tipoSolicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_FormularioOficial_TipoSolicitud',
  })
  tipoSolicitud: TipoSolicitud;

  @ApiProperty({
    example: 'Formulario_Arreglo_Pago_2026.pdf',
    description: 'Nombre del archivo original que subió la administración',
    maxLength: 255,
  })
  @Column({ type: 'varchar', length: 255 })
  nombreArchivoOriginal: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000.pdf',
    description: 'Nombre único interno seguro generado en el servidor',
    maxLength: 255,
  })
  @Column({ type: 'varchar', length: 255 })
  nombreArchivoInterno: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'Tipo MIME validado del archivo',
    maxLength: 100,
    default: 'application/pdf',
  })
  @Column({ type: 'varchar', length: 100, default: 'application/pdf' })
  mimeType: string;

  @ApiProperty({
    example: 1048576,
    description: 'Tamaño del archivo en bytes',
  })
  @Column({ type: 'int' })
  tamano: number;

  @ApiProperty({
    example: 'formularios-oficiales/550e8400-e29b-41d4-a716-446655440000.pdf',
    description:
      'Ruta relativa del archivo en el almacenamiento del sistema (sin exponer rutas físicas del servidor)',
    maxLength: 255,
  })
  @Column({ type: 'varchar', length: 255 })
  ubicacionArchivo: string;

  @ApiProperty({
    example: '2026-10-20T10:00:00.000Z',
    description: 'Fecha y hora en que se cargó o reemplazó el documento',
  })
  @Column({ type: 'datetime' })
  fechaCarga: Date;

  @ApiProperty({
    description: 'Fecha y hora de creación del registro',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última actualización del registro',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
