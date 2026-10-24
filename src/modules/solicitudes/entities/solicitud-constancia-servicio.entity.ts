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
 * Detalle 1:1 del trámite oficial «Constancia de Servicio Existente» (slug: `servicio-existente`).
 *
 * Almacena todos los datos específicos del formulario de constancia de servicio:
 * - Tipo de servicio y NIS
 * - Propietario del inmueble y solicitante
 * - Contacto y medios de notificación
 * - Inmueble (naturaleza, calidad, folio real y planos)
 * - Ubicación geográfica (provincia, cantón, distrito, dirección exacta)
 * - Motivo del trámite (incluyendo opción 'Otro' y detalle libre en `otroMotivo`)
 * - Trámite por realizar
 * - Firma digital / data-URL
 *
 * La cabecera común y el flujo administrativo (estado, código de seguimiento,
 * fecha de ingreso, bajas lógicas y documentos adjuntos) permanecen centralizados
 * y separados en la entidad principal `Solicitud`.
 */
@Entity('SolicitudConstanciaServicio')
@Index('UQ_SolicitudConstanciaServicio_solicitudId', ['solicitudId'], {
  unique: true,
})
@Index('IX_SolicitudConstanciaServicio_nis', ['nis'])
@Index('IX_SolicitudConstanciaServicio_identificacionSolicitante', [
  'identificacionSolicitante',
])
@Index('IX_SolicitudConstanciaServicio_motivo', ['motivo'])
export class SolicitudConstanciaServicio {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del detalle de constancia de servicio',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description: 'Identificador de la solicitud cabecera (relación 1:1)',
  })
  @Column({ type: 'int', unique: true })
  solicitudId: number;

  @OneToOne(
    () => Solicitud,
    (solicitud) => solicitud.detalleConstanciaServicio,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'solicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_SolicitudConstanciaServicio_Solicitud',
  })
  solicitud: Solicitud;

  /* ----- Datos del servicio ----- */

  @ApiProperty({
    example: 'Domiciliar',
    description:
      'Tipo de servicio solicitado o registrado (e.g. Domiciliar, Comercial, Empresarial)',
    maxLength: 100,
  })
  @Column({ type: 'varchar', length: 100 })
  tipoServicio: string;

  @ApiProperty({
    example: 'NIS-45892',
    description:
      'Número de Identificación del Servicio (NIS) como identificador textual',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  nis: string;

  /* ----- Propietario y Solicitante ----- */

  @ApiProperty({
    example: 'María Elena Rodríguez Vargas',
    description:
      'Nombre completo o razón social del propietario registral del inmueble',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  propietarioInmueble: string;

  @ApiProperty({
    example: 'Carlos Alberto Mora Jiménez',
    description: 'Nombre completo de la persona que tramita la solicitud',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  nombreSolicitante: string;

  @ApiProperty({
    example: '1-1234-0567',
    description:
      'Identificación del solicitante (cédula física, jurídica, DIMEX o pasaporte; se conserva con formato original)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  identificacionSolicitante: string;

  @ApiProperty({
    example: 'carlos.mora@ejemplo.com',
    description: 'Correo electrónico de contacto del solicitante',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  correoElectronico: string;

  @ApiProperty({
    example: '8888-1234',
    description: 'Teléfono de contacto del solicitante (formato textual)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  telefono: string;

  /* ----- Datos del Inmueble ----- */

  @ApiPropertyOptional({
    example: '123456-000',
    description:
      'Folio real del inmueble. Opcional cuando el terreno no se encuentra formalmente inscrito.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  folioReal?: string | null;

  @ApiPropertyOptional({
    example: 'SJ-1234567-2020',
    description:
      'Número de plano catastrado del inmueble. Opcional según la condición registral.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoCatastrado?: string | null;

  @ApiPropertyOptional({
    example: 'AG-998877-2019',
    description:
      'Número de plano de agrimensura del inmueble. Opcional / condicional.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoAgrimensura?: string | null;

  @ApiProperty({
    example: 'Inscrito',
    description:
      'Naturaleza del inmueble (e.g. Inscrito | Sin inscribir)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  naturalezaInmueble: string;

  @ApiProperty({
    example: 'Propietario',
    description:
      'Calidad del titular que solicita la constancia (e.g. Propietario | Poseedor | Representante legal)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  calidadTitular: string;

  /* ----- Ubicación del Inmueble ----- */

  @ApiProperty({
    example: 'San José',
    description: 'Provincia donde se ubica el inmueble',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  provincia: string;

  @ApiProperty({
    example: 'Pérez Zeledón',
    description: 'Cantón donde se ubica el inmueble',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  canton: string;

  @ApiProperty({
    example: 'San Isidro de El General',
    description: 'Distrito donde se ubica el inmueble',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  distrito: string;

  @ApiProperty({
    example: '100 metros norte del salón comunal, frente a pulpería La Central',
    description: 'Dirección exacta del inmueble',
    maxLength: 500,
  })
  @Column({ type: 'varchar', length: 500 })
  direccionExacta: string;

  /* ----- Motivo y Trámite ----- */

  @ApiProperty({
    example: 'Bono de vivienda',
    description:
      'Motivo por el cual se solicita la constancia de servicio (e.g. Bono de vivienda, Trámite bancario, Visado municipal, Otro)',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  motivo: string;

  @ApiPropertyOptional({
    example: 'Constancia para trámite ante el Instituto Mixto de Ayuda Social',
    description:
      'Descripción detallada cuando el motivo seleccionado es "Otro"',
    maxLength: 255,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  otroMotivo?: string | null;

  @ApiPropertyOptional({
    example: 'Solicitud de bono de vivienda familiar en entidad autorizada BANHVI',
    description: 'Descripción o especificación del trámite por realizar',
    maxLength: 255,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  tramitePorRealizar?: string | null;

  /* ----- Notificaciones ----- */

  @ApiProperty({
    example: 'Correo electrónico',
    description:
      'Medio de notificación principal preferido por el solicitante (e.g. Correo electrónico | Teléfono)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  medioNotificacionPrincipal: string;

  @ApiPropertyOptional({
    example: 'Teléfono',
    description: 'Medio de notificación secundario alternativo (opcional)',
    maxLength: 80,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 80, nullable: true })
  medioNotificacionSecundario?: string | null;

  /* ----- Firma ----- */

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma digital del solicitante: data-URL en base64 o ruta/URL del archivo de firma',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  firma?: string | null;

  /* ----- Auditoría de detalle ----- */

  @ApiProperty({
    description: 'Fecha y hora de creación del registro de detalle',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última actualización del registro de detalle',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
