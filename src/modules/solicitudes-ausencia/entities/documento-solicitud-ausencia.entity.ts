import { ApiProperty } from '@nestjs/swagger';
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
import { SolicitudAusencia } from './solicitud-ausencia.entity';

@Entity('DocumentoSolicitudAusencia')
@Index('IX_DocumentoSolicitudAusencia_solicitudId', ['solicitudId'])
export class DocumentoSolicitudAusencia {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 12 })
  @Column({ type: 'int' })
  solicitudId: number;

  @ManyToOne(() => SolicitudAusencia, (solicitud) => solicitud.documentos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'solicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_DocumentoSolicitudAusencia_SolicitudAusencia',
  })
  solicitud: SolicitudAusencia;

  @ApiProperty({ example: 'constancia.pdf' })
  @Column({ type: 'varchar', length: 255 })
  nombreOriginal: string;

  @ApiProperty({ example: 'application/pdf' })
  @Column({ type: 'varchar', length: 100 })
  tipoArchivo: string;

  @ApiProperty({
    example: '/api/v1/fontanero/solicitudes-ausencia/12/documentos/file.pdf',
  })
  @Column({ type: 'varchar', length: 500 })
  rutaReferenciaArchivo: string;

  @ApiProperty({ example: 2048 })
  @Column({ type: 'int' })
  tamanio: number;

  @ApiProperty()
  @CreateDateColumn()
  fechaCarga: Date;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
