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
 * Detalle 1:1 del trámite oficial
 * «Constancia de Infraestructura Frente a Linderos de un Inmueble»
 * (slug: `infraestructura-linderos`).
 *
 * Cabecera común (estado, código, fechas) vive en `Solicitud`.
 *
 * Geo: texto libre (provincia/cantón/distrito). No existen catálogos
 * Provincia/Cantón/Distrito en BD SIGASJ.
 *
 * Propósito: varchar controlado. Único valor confirmado en el repo:
 * «Reunión de fincas» (documentRequirementsConfig). Lista completa: BLOCKED/PDF.
 * Cardinalidad: un solo propósito (sin evidencia de multi-selección).
 *
 * Calidad del titular / medios de notificación: mismas etiquetas ASADA
 * usadas en Cambio de Titular (`CalidadTitularCambioTitular`,
 * `MedioNotificacionCambioTitular`); almacenamiento varchar.
 *
 * Firma: text / nvarchar(max) (data-URL o referencia), no binario.
 */
@Entity('SolicitudInfraestructuraLinderos')
@Index('UQ_SolicitudInfraestructuraLinderos_solicitudId', ['solicitudId'], {
  unique: true,
})
@Index('IX_SolicitudInfraestructuraLinderos_nis', ['nis'])
export class SolicitudInfraestructuraLinderos {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del detalle de infraestructura/linderos',
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
    (solicitud) => solicitud.detalleInfraestructuraLinderos,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'solicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_SolicitudInfraestructuraLinderos_Solicitud',
  })
  solicitud: Solicitud;

  /* ----- Servicio / inmueble ----- */

  @ApiProperty({
    example: 'NIS-45892',
    description:
      'Número de identificación del servicio (NIS) como identificador textual',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  nis: string;

  /**
   * Discriminante del propietario: «Persona física» | «Persona jurídica».
   * Los bloques exclusivos quedan nullable según este valor.
   */
  @ApiProperty({
    example: 'Persona física',
    description:
      'Tipo de persona del propietario (Persona física | Persona jurídica)',
    maxLength: 40,
  })
  @Column({ type: 'varchar', length: 40 })
  tipoPersona: string;

  /* ----- Propietario — persona física (condicionales) ----- */

  @ApiPropertyOptional({
    example: 'María Elena',
    description: 'Nombre del propietario (persona física)',
    maxLength: 100,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  nombreFisica?: string | null;

  @ApiPropertyOptional({
    example: 'Rodríguez Vargas',
    description: 'Apellidos del propietario (persona física)',
    maxLength: 100,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  apellidosFisica?: string | null;

  @ApiPropertyOptional({
    example: '1-1234-0567',
    description:
      'Identificación del propietario persona física (texto; conserva ceros/guiones)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  identificacionFisica?: string | null;

  @ApiPropertyOptional({
    example: '8888-1234',
    description: 'Teléfono del propietario persona física (texto)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  telefonoFisica?: string | null;

  /* ----- Propietario — persona jurídica (condicionales) ----- */

  @ApiPropertyOptional({
    example: 'Inversiones del Valle S.A.',
    description: 'Razón social del propietario (persona jurídica)',
    maxLength: 200,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 200, nullable: true })
  razonSocial?: string | null;

  @ApiPropertyOptional({
    example: '3-101-123456',
    description: 'Cédula jurídica del propietario (texto)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  cedulaJuridica?: string | null;

  @ApiPropertyOptional({
    example: 'Luis Alberto Mora Chaves',
    description: 'Nombre del representante legal (persona jurídica)',
    maxLength: 150,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 150, nullable: true })
  nombreRepresentante?: string | null;

  @ApiPropertyOptional({
    example: '1-0987-6543',
    description: 'Identificación del representante legal (texto)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  identificacionRepresentante?: string | null;

  @ApiPropertyOptional({
    example: '8777-4321',
    description: 'Teléfono del representante / persona jurídica (texto)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  telefonoRepresentante?: string | null;

  @ApiProperty({
    example: 'Propietario',
    description:
      'Calidad del titular (Propietario | Poseedor | Representante legal — mismas etiquetas ASADA que Cambio de Titular)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  calidadTitular: string;

  /* ----- Ubicación ----- */

  @ApiProperty({
    example: 'San José',
    description:
      'Provincia del inmueble (texto libre; sin catálogo geográfico en BD)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  provincia: string;

  @ApiProperty({
    example: 'Pérez Zeledón',
    description: 'Cantón del inmueble (texto libre)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  canton: string;

  @ApiProperty({
    example: 'San Isidro de El General',
    description: 'Distrito del inmueble (texto libre)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  distrito: string;

  @ApiProperty({
    example: '100 m norte de la iglesia, costado oeste',
    description: 'Dirección exacta del inmueble',
    maxLength: 500,
  })
  @Column({ type: 'varchar', length: 500 })
  direccionExacta: string;

  /* ----- Datos registrales / planos ----- */

  @ApiPropertyOptional({
    example: '123456-000',
    description: 'Folio real del inmueble (opcional si no está inscrito)',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  folioReal?: string | null;

  @ApiPropertyOptional({
    example: 'SJ-1234567-2020',
    description:
      'Referencia/número del plano catastrado (el adjunto PDF es requisito aparte)',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoCatastrado?: string | null;

  @ApiPropertyOptional({
    example: 'AG-998877-2019',
    description:
      'Referencia/número del plano de agrimensura (condicional: propósito «Reunión de fincas»)',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoAgrimensura?: string | null;

  @ApiProperty({
    example: 'Reunión de fincas',
    description:
      'Propósito de la constancia (opción cerrada a nivel de aplicación; un solo valor)',
    maxLength: 120,
  })
  @Column({ type: 'varchar', length: 120 })
  proposito: string;

  /* ----- Notificaciones ----- */

  @ApiProperty({
    example: 'Correo electrónico',
    description: 'Medio de notificación principal',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  medioNotificacionPrincipal: string;

  @ApiPropertyOptional({
    example: 'correo@ejemplo.com',
    description:
      'Destino concreto del medio principal (correo, teléfono o dirección)',
    maxLength: 200,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 200, nullable: true })
  valorNotificacionPrincipal?: string | null;

  @ApiPropertyOptional({
    example: 'Teléfono',
    description: 'Medio de notificación secundario (opcional)',
    maxLength: 80,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 80, nullable: true })
  medioNotificacionSecundario?: string | null;

  @ApiPropertyOptional({
    example: '8888-1234',
    description: 'Destino concreto del medio secundario',
    maxLength: 200,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 200, nullable: true })
  valorNotificacionSecundario?: string | null;

  /* ----- Firma ----- */

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma: data-URL base64 o URL/ruta de referencia (mismo patrón que SolicitudCambioTitular)',
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
