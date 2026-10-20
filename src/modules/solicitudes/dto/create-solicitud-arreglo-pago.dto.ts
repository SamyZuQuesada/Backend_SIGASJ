import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PlazoArregloPago,
  PLAZOS_ARREGLO_PAGO_PERMITIDOS,
} from '../../../common/enums/plazo-arreglo-pago.enum';

/**
 * DTO para la recepción y validación del formulario oficial de Solicitud de Arreglo de Pago Domiciliar.
 * Todos los campos requeridos corresponden a las casillas del documento físico oficial de la ASADA.
 */
export class CreateSolicitudArregloPagoDto {
  @ApiProperty({
    example: 'Juan Carlos Rodríguez Mora',
    description: 'Nombre completo de la persona solicitante titular o usuaria del servicio',
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Cédula de identidad física, jurídica o DIMEX del solicitante',
    maxLength: 30,
  })
  @IsNotEmpty({ message: 'La cédula es obligatoria' })
  @IsString({ message: 'La cédula debe ser una cadena de texto' })
  @MaxLength(30, { message: 'La cédula no puede exceder 30 caracteres' })
  cedula: string;

  @ApiProperty({
    example: 'San Juan de Desamparados, 200m norte de la plaza',
    description: 'Lugar de residencia oficial según el formulario ("Vecino de")',
    maxLength: 200,
  })
  @IsNotEmpty({ message: 'El lugar de residencia (vecinoDe) es obligatorio' })
  @IsString({ message: 'El lugar de residencia (vecinoDe) debe ser una cadena de texto' })
  @MaxLength(200, { message: 'El lugar de residencia no puede exceder 200 caracteres' })
  vecinoDe: string;

  @ApiProperty({
    example: '8888-1234',
    description: 'Número de teléfono de contacto para notificaciones del trámite',
    maxLength: 30,
  })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(30, { message: 'El teléfono no puede exceder 30 caracteres' })
  telefono: string;

  @ApiProperty({
    example: 'CTA-00984',
    description: 'Número de cuenta, contrato o NIS del servicio de agua potable ante la ASADA',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'El número de cuenta del servicio es obligatorio' })
  @IsString({ message: 'El número de cuenta del servicio debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El número de cuenta no puede exceder 50 caracteres' })
  numeroCuentaServicio: string;

  @ApiProperty({
    example: 25000,
    description: 'Monto en colones ofrecido o cancelado como prima inicial (no puede ser negativo)',
    minimum: 0,
  })
  @IsNotEmpty({ message: 'El monto de la prima inicial es obligatorio' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto de la prima inicial debe ser un número válido' })
  @Min(0, { message: 'El monto de la prima inicial no puede ser negativo' })
  montoPrimaInicial: number;

  @ApiProperty({
    example: PlazoArregloPago.MESES_6,
    enum: PlazoArregloPago,
    description:
      'Plazo en meses seleccionado para saldar el monto adeudado (ningún valor viene por defecto; admite sólo opciones oficiales)',
  })
  @IsNotEmpty({ message: 'El plazo seleccionado es obligatorio' })
  @IsEnum(PlazoArregloPago, {
    message: `El plazo seleccionado no es válido. Opciones permitidas: ${PLAZOS_ARREGLO_PAGO_PERMITIDOS.join(', ')}`,
  })
  plazoSeleccionado: PlazoArregloPago;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma del solicitante (formato data-URL base64 del canvas digital o URL del archivo digitalizado)',
  })
  @IsOptional()
  @IsString({ message: 'La firma debe ser una cadena de texto' })
  firma?: string;
}
