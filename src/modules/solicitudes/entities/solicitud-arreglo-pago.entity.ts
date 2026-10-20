import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  isPlazoArregloPagoValido,
  PlazoArregloPago,
} from '../../../common/enums/plazo-arreglo-pago.enum';
import { Solicitud } from './solicitud.entity';

/**
 * Entidad de detalle que almacena los datos específicos del formulario oficial
 * de Solicitud de Arreglo de Pago Domiciliar ante la ASADA.
 *
 * Mantiene relación 1:1 con la entidad cabecera Solicitud, heredando de ella
 * la trazabilidad, fecha general, código de seguimiento y estado del trámite.
 */
@Entity('SolicitudArregloPago')
@Index('UQ_SolicitudArregloPago_solicitudId', ['solicitudId'], { unique: true })
@Index('IX_SolicitudArregloPago_cedula', ['cedula'])
@Index('IX_SolicitudArregloPago_numeroCuentaServicio', ['numeroCuentaServicio'])
export class SolicitudArregloPago {
  @ApiProperty({
    example: 1,
    description: 'Identificador único numérico del registro de detalle de arreglo de pago',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description: 'Identificador de la solicitud cabecera vinculada (relación 1:1)',
  })
  @Column({ type: 'int', unique: true })
  solicitudId: number;

  @OneToOne(() => Solicitud, (solicitud) => solicitud.detalleArregloPago, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'solicitudId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_SolicitudArregloPago_Solicitud',
  })
  solicitud: Solicitud;

  @ApiProperty({
    example: 'Juan Carlos Rodríguez Mora',
    description: 'Nombre completo de la persona solicitante que asume el compromiso del arreglo',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Cédula física, jurídica o documento de residencia (DIMEX) del solicitante',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  cedula: string;

  @ApiProperty({
    example: 'San Juan, 200 metros norte de la plaza de deportes',
    description: 'Lugar de residencia y dirección oficial según el formulario físico ("Vecino de")',
    maxLength: 200,
  })
  @Column({ type: 'varchar', length: 200 })
  vecinoDe: string;

  @ApiProperty({
    example: '8888-1234',
    description: 'Número de teléfono de contacto para notificaciones del trámite',
    maxLength: 30,
  })
  @Column({ type: 'varchar', length: 30 })
  telefono: string;

  @ApiProperty({
    example: 'CTA-45892',
    description: 'Número de cuenta, contrato o NIS del servicio de agua registrado ante la ASADA',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  numeroCuentaServicio: string;

  @ApiProperty({
    example: 25000.0,
    description: 'Monto en colones ofrecido o cancelado como prima inicial al formalizar el arreglo',
  })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => (value != null ? Number(value) : value),
    },
  })
  montoPrimaInicial: number;

  @ApiProperty({
    example: PlazoArregloPago.MESES_6,
    enum: PlazoArregloPago,
    description: 'Plazo seleccionado para saldar el monto adeudado (admite únicamente opciones oficiales)',
  })
  @Column({ type: 'varchar', length: 50 })
  plazoSeleccionado: PlazoArregloPago | string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Referencia o almacenamiento digital de la firma: puede ser data-URL en base64 o URL al archivo digital',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  firma?: string | null;

  @ApiProperty({ description: 'Fecha y hora de creación del registro' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Fecha y hora de última actualización del registro' })
  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validarCampos(): void {
    if (this.plazoSeleccionado && !isPlazoArregloPagoValido(this.plazoSeleccionado)) {
      throw new BadRequestException(
        `El plazo '${this.plazoSeleccionado}' no es válido. Opciones permitidas: ${Object.values(PlazoArregloPago).join(', ')}`,
      );
    }

    if (
      this.montoPrimaInicial !== undefined &&
      this.montoPrimaInicial !== null &&
      Number(this.montoPrimaInicial) < 0
    ) {
      throw new BadRequestException(
        'El monto de la prima inicial no puede ser negativo.',
      );
    }
  }
}
