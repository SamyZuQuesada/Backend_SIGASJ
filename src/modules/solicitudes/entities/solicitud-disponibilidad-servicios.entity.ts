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
 * «Constancia de Disponibilidad de Servicios»
 * (slug: `disponibilidad-servicios`).
 *
 * Cabecera común (estado, código, fechas de sistema) vive en `Solicitud`.
 *
 * Fuente de campos: PBI modelo de datos + `documentRequirementsConfig` (FE)
 * + patrones de trámites hermanos (Infraestructura / Cambio de Titular).
 * PDF/formulario oficial: NO disponible en el repositorio → catálogos
 * cerrados de propósitos, unidades de área/caudal y condición exacta de
 * `numeroDisponibilidadAnterior` quedan BLOCKED (no se inventan).
 *
 * Geo: texto libre (provincia/cantón/distrito). No existen catálogos
 * Provincia/Cantón/Distrito en BD SIGASJ.
 *
 * Propósito: varchar controlado a nivel de aplicación; un solo valor
 * (sin evidencia de multi-selección). Lista completa oficial: BLOCKED.
 *
 * Persona física / jurídica: bloques exclusivos nullable según `tipoPersona`.
 *
 * Campos de proyecto (dormitorios, unidades, área, niveles, caudal,
 * disponibilidad anterior, NIS): nullable cuando no correspondan.
 *
 * Firma: text / nvarchar(max) (data-URL o URL/ruta), mismo patrón que
 * `SolicitudCambioTitular` / `SolicitudInfraestructuraLinderos`.
 *
 * `autorizacionInspeccion`: bit (consentimiento Sí/No del formulario).
 *
 * Decimales: `areaConstruccion` decimal(12,2); `caudalRequerido` decimal(12,4).
 * Unidades oficiales (p. ej. m², L/s): BLOCKED sin PDF.
 */
@Entity('SolicitudDisponibilidadServicios')
@Index('UQ_SolicitudDisponibilidadServicios_solicitudId', ['solicitudId'], {
  unique: true,
})
@Index('IX_SolicitudDisponibilidadServicios_nis', ['nis'])
@Index('IX_SolicitudDisponibilidadServicios_proposito', ['proposito'])
export class SolicitudDisponibilidadServicios {
  @ApiProperty({
    example: 1,
    description:
      'Identificador único del detalle de disponibilidad de servicios',
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
    (solicitud) => solicitud.detalleDisponibilidadServicios,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'solicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_SolicitudDisponibilidadServicios_Solicitud',
  })
  solicitud: Solicitud;

  /**
   * Discriminante del titular: «Persona física» | «Persona jurídica».
   * Los bloques exclusivos quedan nullable según este valor.
   */
  @ApiProperty({
    example: 'Persona física',
    description:
      'Tipo de persona del titular (Persona física | Persona jurídica)',
    maxLength: 40,
  })
  @Column({ type: 'varchar', length: 40 })
  tipoPersona: string;

  /* ----- Titular — persona física (condicionales) ----- */

  @ApiPropertyOptional({
    example: 'María Elena',
    description: 'Nombre del titular (persona física)',
    maxLength: 100,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  nombreFisica?: string | null;

  @ApiPropertyOptional({
    example: 'Rodríguez',
    description: 'Primer apellido del titular (persona física)',
    maxLength: 100,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  primerApellidoFisica?: string | null;

  @ApiPropertyOptional({
    example: 'Vargas',
    description: 'Segundo apellido del titular (persona física)',
    maxLength: 100,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  segundoApellidoFisica?: string | null;

  @ApiPropertyOptional({
    example: '1-1234-0567',
    description:
      'Identificación del titular persona física (texto; conserva ceros/guiones)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  identificacionFisica?: string | null;

  @ApiPropertyOptional({
    example: '8888-1234',
    description: 'Teléfono del titular persona física (texto)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  telefonoFisica?: string | null;

  /* ----- Titular — persona jurídica (condicionales) ----- */

  @ApiPropertyOptional({
    example: 'Inversiones del Valle S.A.',
    description: 'Razón social del titular (persona jurídica)',
    maxLength: 200,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 200, nullable: true })
  razonSocial?: string | null;

  @ApiPropertyOptional({
    example: '3-101-123456',
    description: 'Identificación jurídica del titular (texto)',
    maxLength: 30,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  identificacionJuridica?: string | null;

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

  /* ----- Notificaciones ----- */

  @ApiProperty({
    example: 'Correo electrónico',
    description:
      'Medio de notificación principal (texto; mismas etiquetas ASADA que otros trámites)',
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

  /* ----- Ubicación ----- */

  @ApiProperty({
    example: 'San José',
    description:
      'Provincia del inmueble/proyecto (texto libre; sin catálogo geográfico en BD)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  provincia: string;

  @ApiProperty({
    example: 'Pérez Zeledón',
    description: 'Cantón del inmueble/proyecto (texto libre)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  canton: string;

  @ApiProperty({
    example: 'San Isidro de El General',
    description: 'Distrito del inmueble/proyecto (texto libre)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  distrito: string;

  @ApiProperty({
    example: '100 m norte de la iglesia, costado oeste',
    description: 'Dirección exacta del inmueble/proyecto',
    maxLength: 500,
  })
  @Column({ type: 'varchar', length: 500 })
  direccionExacta: string;

  /* ----- Datos registrales / servicio ----- */

  @ApiPropertyOptional({
    example: '123456-000',
    description:
      'Folio real del inmueble (texto; opcional si no está inscrito)',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  folioReal?: string | null;

  @ApiPropertyOptional({
    example: 'SJ-1234567-2020',
    description:
      'Referencia/número del plano catastrado (el adjunto es DocumentoSolicitud)',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoCatastrado?: string | null;

  @ApiPropertyOptional({
    example: 'AG-998877-2019',
    description:
      'Referencia/número del plano de agrimensura (condicional según requisitos FE)',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  planoAgrimensura?: string | null;

  @ApiPropertyOptional({
    example: 'NIS-45892',
    description:
      'NIS / identificador de servicio (texto). Nullable: la constancia puede solicitarse antes de existir servicio.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  nis?: string | null;

  @ApiProperty({
    example: 'Inscrito',
    description:
      'Naturaleza del inmueble (texto; etiquetas ASADA conocidas: Inscrito | Sin inscribir)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  naturalezaInmueble: string;

  @ApiProperty({
    example: 'Propietario',
    description:
      'Calidad del titular (Propietario | Poseedor | Representante legal — mismas etiquetas ASADA)',
    maxLength: 80,
  })
  @Column({ type: 'varchar', length: 80 })
  calidadTitular: string;

  /* ----- Propósito y disponibilidad anterior ----- */

  @ApiProperty({
    example: 'Fraccionamiento',
    description:
      'Propósito de la constancia (un solo valor; catálogo oficial completo BLOCKED sin PDF)',
    maxLength: 120,
  })
  @Column({ type: 'varchar', length: 120 })
  proposito: string;

  @ApiPropertyOptional({
    example: 'DISP-2024-00123',
    description:
      'Número de disponibilidad anterior cuando aplica (regla exacta BLOCKED sin PDF). NULL si no corresponde.',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  numeroDisponibilidadAnterior?: string | null;

  /* ----- Datos del proyecto (condicionales) ----- */

  @ApiPropertyOptional({
    example: 'Construcción de 4 unidades habitacionales de dos niveles',
    description: 'Descripción del proyecto (nullable según propósito)',
    maxLength: 2000,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  descripcionProyecto?: string | null;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Cantidad de dormitorios. NULL cuando el propósito/proyecto no lo requiere.',
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  cantidadDormitorios?: number | null;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Unidades habitacionales (concepto distinto de dormitorios). NULL cuando no corresponda.',
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  unidadesHabitacionales?: number | null;

  @ApiPropertyOptional({
    example: 185.5,
    description:
      'Área de construcción (decimal). Unidad oficial BLOCKED sin PDF.',
    nullable: true,
  })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | number | null) =>
        value != null ? Number(value) : value,
    },
  })
  areaConstruccion?: number | null;

  @ApiPropertyOptional({
    example: 2,
    description: 'Cantidad de niveles/pisos. NULL cuando no corresponda.',
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  niveles?: number | null;

  @ApiPropertyOptional({
    example: 0.75,
    description: 'Caudal requerido (decimal). Unidad oficial BLOCKED sin PDF.',
    nullable: true,
  })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | number | null) =>
        value != null ? Number(value) : value,
    },
  })
  caudalRequerido?: number | null;

  /* ----- Autorización e inspección / firma ----- */

  @ApiProperty({
    example: true,
    description:
      'Autorización de inspección del inmueble/proyecto (consentimiento Sí/No)',
  })
  @Column()
  autorizacionInspeccion: boolean;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma del solicitante: data-URL base64 o URL/ruta de referencia',
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
