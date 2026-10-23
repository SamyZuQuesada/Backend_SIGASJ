import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { Solicitud } from './solicitud.entity';

/**
 * Detalle 1:1 del trámite oficial «Cambio de Nombre del Titular del Servicio».
 *
 * Los datos comunes del trámite (estado, código de seguimiento, fecha de ingreso)
 * viven en la cabecera `Solicitud`. Aquí solo se persisten los campos específicos
 * del formulario de cambio de titular.
 *
 * Nota: las opciones oficiales de `naturalezaInmueble`, `calidadTitular` y medios
 * de notificación no están catalogadas aún en el repositorio (formulario digital /
 * PDF ausente). Se almacenan como texto controlado por longitud hasta confirmar
 * el catálogo ASADA; no se inventan enums.
 */
@Entity('SolicitudCambioTitular')
@Index('UQ_SolicitudCambioTitular_solicitudId', ['solicitudId'], {
  unique: true,
})
@Index('IX_SolicitudCambioTitular_identificacionSolicitante', [
  'identificacionSolicitante',
])
@Index('IX_SolicitudCambioTitular_nis', ['nis'])
export class SolicitudCambioTitular {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del detalle de cambio de titular',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description: 'Identificador de la solicitud cabecera (relación 1:1)',
  })
  @Column({ type: 'int', unique: true })
  solicitudId: number;

  @OneToOne(() => Solicitud, (solicitud) => solicitud.detalleCambioTitular, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'solicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_SolicitudCambioTitular_Solicitud',
  })
  solicitud: Solicitud;

  /* ----- Solicitante ----- */

  @ApiProperty({
    example: 'Ana Lucía Vargas Quirós',
    description: 'Nombre completo de la persona que presenta el trámite',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  nombreSolicitante: string;

  @ApiProperty({
    example: '1-1234-0567',
    description:
      'Identificación del solicitante (cédula, DIMEX u otro documento; se conserva como texto)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  identificacionSolicitante: string;

  @ApiProperty({
    example: '8888-1234',
    description: 'Teléfono de contacto del solicitante (formato textual)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  telefono: string;

  /* ----- Propietario registral ----- */

  @ApiProperty({
    example: 'Carlos Alberto Mora Jiménez',
    description:
      'Nombre completo del propietario registral del inmueble (puede diferir del solicitante)',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  nombrePropietarioRegistral: string;

  @ApiProperty({
    example: '1-0987-6543',
    description: 'Identificación del propietario registral (texto)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  identificacionPropietario: string;

  /* ----- Inmueble ----- */

  @ApiPropertyOptional({
    example: '123456-000',
    description:
      'Folio real del inmueble. Opcional cuando el terreno no está inscrito.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  folioReal?: string | null;

  @ApiPropertyOptional({
    example: 'SJ-1234567-2020',
    description:
      'Número o código del plano catastrado. Opcional según el caso del inmueble.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoCatastrado?: string | null;

  @ApiPropertyOptional({
    example: 'AG-998877-2019',
    description:
      'Número o código del plano de agrimensura. Opcional / condicional.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoAgrimensura?: string | null;

  @ApiProperty({
    example: 'Propiedad inscrita',
    description:
      'Naturaleza del inmueble según opción oficial del formulario (texto hasta confirmar catálogo)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  naturalezaInmueble: string;

  @ApiProperty({
    example: 'Propietario',
    description:
      'Calidad con la que el titular realiza el trámite (texto hasta confirmar catálogo)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  calidadTitular: string;

  /* ----- Servicio ----- */

  @ApiProperty({
    example: 'NIS-45892',
    description:
      'Número de identificación del servicio (NIS / cuenta) tratado como identificador textual',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  nis: string;

  @ApiProperty({
    example: 'Carlos Alberto Mora Jiménez',
    description: 'Nombre a quien aparece asociada actualmente la facturación',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  facturaANombreDe: string;

  /* ----- Notificaciones ----- */

  @ApiProperty({
    example: 'Correo electrónico',
    description:
      'Medio de notificación principal (texto hasta confirmar catálogo oficial)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  medioNotificacionPrincipal: string;

  @ApiPropertyOptional({
    example: 'Teléfono',
    description:
      'Medio de notificación secundario. Opcional según el formulario.',
    maxLength: 80,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 80, nullable: true })
  medioNotificacionSecundario?: string | null;

  /* ----- Firma ----- */

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Referencia de la firma digital: data-URL base64 o URL/ruta al archivo (mismo patrón que SolicitudArregloPago)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  firma?: string | null;

  @ApiProperty({ description: 'Fecha y hora de creación del registro' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última actualización del registro',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
