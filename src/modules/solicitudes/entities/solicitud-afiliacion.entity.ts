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
 * Detalle 1:1 del trámite oficial «Solicitud de Afiliación»
 * (slug: `afiliacion`).
 *
 * Cabecera común (estado, código, fechas de sistema) vive en `Solicitud`.
 * `fechaSolicitud` es la fecha del formulario (distinta de `Solicitud.fechaIngreso`
 * / `createdAt` cuando el ciudadano declara una fecha distinta).
 *
 * Fuente de campos públicos: backlog del modelo de datos de afiliación +
 * `documentRequirementsConfig` (FE) — dos recomendaciones de afiliados activos
 * y firmas correspondientes. PDF oficial: no disponible en el repositorio;
 * opciones de estado civil y campos de Junta Directiva: BLOCKED (no inventados).
 *
 * Clasificación:
 * - PUBLIC_INPUT: datos del solicitante, registrales, contacto, recomendaciones.
 * - ADMIN_ONLY: pendiente de PDF oficial de Junta Directiva (sin columnas inventadas).
 *
 * Firma: text / nvarchar(max) (data-URL o URL/ruta), mismo patrón que
 * `SolicitudArregloPago` / `SolicitudCambioTitular`. No se crea storage nuevo.
 *
 * Recomendaciones: exactamente dos, modeladas como columnas prefijadas
 * (recomendacion1* / recomendacion2*) — no entidad hija — porque el formulario
 * fija cardinalidad 2 y el resto de detalles SIGASJ usan columnas planas.
 *
 * `numeroAbonado` / `numeroPlano` / `folioReal` / identificaciones: varchar
 * (preserva ceros/guiones; no FK a Servicio/Asociado — el formulario captura
 * el valor textual del trámite).
 */
@Entity('SolicitudAfiliacion')
@Index('UQ_SolicitudAfiliacion_solicitudId', ['solicitudId'], { unique: true })
@Index('IX_SolicitudAfiliacion_identificacion', ['identificacion'])
@Index('IX_SolicitudAfiliacion_numeroAbonado', ['numeroAbonado'])
export class SolicitudAfiliacion {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del detalle de afiliación',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description: 'Identificador de la solicitud cabecera (relación 1:1)',
  })
  @Column({ type: 'int', unique: true })
  solicitudId: number;

  @OneToOne(() => Solicitud, (solicitud) => solicitud.detalleAfiliacion, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'solicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_SolicitudAfiliacion_Solicitud',
  })
  solicitud: Solicitud;

  /* ----- PUBLIC_INPUT: datos del formulario ----- */

  @ApiProperty({
    example: '2026-10-23',
    description:
      'Fecha declarada en el formulario de afiliación (no sustituye fechaIngreso de Solicitud)',
  })
  @Column({ type: 'date' })
  fechaSolicitud: Date | string;

  @ApiProperty({
    example: 'María Elena Rodríguez Vargas',
    description: 'Nombre completo del solicitante',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @ApiProperty({
    example: '1-1234-0567',
    description:
      'Identificación del solicitante (texto; conserva ceros iniciales y guiones)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  identificacion: string;

  @ApiProperty({
    example: 'San Juan, 200 m norte de la plaza de deportes',
    description:
      'Campo «Vecino de»: lugar de residencia / dirección (texto libre, mismo criterio que Arreglo de Pago)',
    maxLength: 200,
  })
  @Column({ type: 'varchar', length: 200 })
  vecinoDe: string;

  @ApiProperty({
    example: 'Casado(a)',
    description:
      'Estado civil según el formulario. Catálogo oficial de opciones: BLOCKED (PDF ausente); se almacena como texto controlado por longitud',
    maxLength: 40,
  })
  @Column({ type: 'varchar', length: 40 })
  estadoCivil: string;

  @ApiProperty({
    example: '8888-1234',
    description: 'Teléfono de contacto (formato textual)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  telefono: string;

  @ApiProperty({
    example: 'maria.rodriguez@ejemplo.com',
    description: 'Correo electrónico del solicitante',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  correoElectronico: string;

  @ApiProperty({
    example: '45892',
    description:
      'Número de abonado declarado en el formulario (identificador textual; no FK a Servicio)',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  numeroAbonado: string;

  @ApiProperty({
    example: 'SJ-1234567-2020',
    description: 'Número / código de plano (textual; admite letras y guiones)',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  numeroPlano: string;

  @ApiPropertyOptional({
    example: '123456-000',
    description:
      'Folio real del inmueble. Opcional cuando el terreno no está inscrito (mismo criterio que otros trámites)',
    maxLength: 50,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  folioReal?: string | null;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma del solicitante: data-URL base64 o URL/ruta de referencia (patrón existente de solicitudes)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  firmaSolicitante?: string | null;

  /* ----- PUBLIC_INPUT: Recomendación 1 (afiliado activo) ----- */

  @ApiProperty({
    example: 'Carlos Alberto Mora Chaves',
    description: 'Nombre completo del recomendante 1',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  recomendacion1Nombre: string;

  @ApiProperty({
    example: '1-0987-6543',
    description: 'Identificación del recomendante 1 (texto)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  recomendacion1Identificacion: string;

  @ApiProperty({
    example: '12045',
    description: 'Número de abonado del recomendante 1 (afiliado activo)',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  recomendacion1NumeroAbonado: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description: 'Firma del recomendante 1 (data-URL o URL/ruta)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  recomendacion1Firma?: string | null;

  /* ----- PUBLIC_INPUT: Recomendación 2 (afiliado activo) ----- */

  @ApiProperty({
    example: 'Ana Lucía Vargas Quirós',
    description: 'Nombre completo del recomendante 2',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  recomendacion2Nombre: string;

  @ApiProperty({
    example: '1-2345-6789',
    description: 'Identificación del recomendante 2 (texto)',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  recomendacion2Identificacion: string;

  @ApiProperty({
    example: '13088',
    description: 'Número de abonado del recomendante 2 (afiliado activo)',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  recomendacion2NumeroAbonado: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description: 'Firma del recomendante 2 (data-URL o URL/ruta)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  recomendacion2Firma?: string | null;

  /*
   * ADMIN_ONLY — Junta Directiva:
   * BLOCKED. FormularioOficial PDF de afiliación no está cargado en el repo/BD.
   * No se inventan columnas (fecha de sesión, acuerdo, resultado, firmas JD, etc.).
   * Ampliar solo con fuente PDF/oficial ASADA.
   */

  @ApiProperty({ description: 'Fecha y hora de creación del registro' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última actualización del registro',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
