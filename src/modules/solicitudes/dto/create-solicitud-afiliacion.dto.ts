import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * DTO público para registrar «Solicitud de Afiliación».
 * Solo campos PUBLIC_INPUT del modelo 4.7.1 (sin Junta Directiva / admin).
 *
 * Recomendaciones: columnas embebidas (recomendacion1* / recomendacion2*),
 * ambas obligatorias salvo firmas (opcionales, mismo patrón de otros trámites).
 *
 * estadoCivil: texto con longitud (catálogo oficial BLOCKED — sin PDF).
 * numeroAbonado: textual; no se valida existencia en Servicio/Asociado (4.7.1).
 */
export class CreateSolicitudAfiliacionDto {
  @ApiProperty({
    example: '2026-10-23',
    description: 'Fecha del formulario (YYYY-MM-DD)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La fecha de solicitud es obligatoria' })
  @IsDateString(
    {},
    {
      message:
        'La fecha de solicitud debe tener un formato de fecha válido (YYYY-MM-DD)',
    },
  )
  fechaSolicitud: string;

  @ApiProperty({
    example: 'María Elena Rodríguez Vargas',
    description: 'Nombre completo del solicitante',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Identificación del solicitante (texto; admite guiones/ceros)',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La identificación es obligatoria' })
  @IsString({ message: 'La identificación debe ser una cadena de texto' })
  @MaxLength(30, {
    message: 'La identificación no puede exceder 30 caracteres',
  })
  identificacion: string;

  @ApiProperty({
    example: 'San Juan, 200 m norte de la plaza de deportes',
    description: 'Vecino de / lugar de residencia (texto libre)',
    maxLength: 200,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El campo vecino de es obligatorio' })
  @IsString({ message: 'El campo vecino de debe ser una cadena de texto' })
  @MaxLength(200, {
    message: 'El campo vecino de no puede exceder 200 caracteres',
  })
  vecinoDe: string;

  @ApiProperty({
    example: 'Casado(a)',
    description:
      'Estado civil (texto). Opciones oficiales: pendientes de PDF; se valida tipo/longitud',
    maxLength: 40,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El estado civil es obligatorio' })
  @IsString({ message: 'El estado civil debe ser una cadena de texto' })
  @MaxLength(40, {
    message: 'El estado civil no puede exceder 40 caracteres',
  })
  estadoCivil: string;

  @ApiProperty({
    example: '8888-1234',
    description: 'Teléfono de contacto (texto)',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(30, { message: 'El teléfono no puede exceder 30 caracteres' })
  telefono: string;

  @ApiProperty({
    example: 'maria.rodriguez@ejemplo.com',
    description: 'Correo electrónico del solicitante',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(150, {
    message: 'El correo electrónico no puede exceder 150 caracteres',
  })
  correoElectronico: string;

  @ApiProperty({
    example: '45892',
    description:
      'Número de abonado (identificador textual; no se valida existencia en BD)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El número de abonado es obligatorio' })
  @IsString({ message: 'El número de abonado debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'El número de abonado no puede exceder 50 caracteres',
  })
  numeroAbonado: string;

  @ApiProperty({
    example: 'SJ-1234567-2020',
    description: 'Número / código de plano (texto)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El número de plano es obligatorio' })
  @IsString({ message: 'El número de plano debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'El número de plano no puede exceder 50 caracteres',
  })
  numeroPlano: string;

  @ApiPropertyOptional({
    example: '123456-000',
    description: 'Folio real (opcional si el inmueble no está inscrito)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El folio real debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El folio real no puede exceder 50 caracteres' })
  folioReal?: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma del solicitante: data-URL base64 o URL/ruta (patrón existente)',
  })
  @IsOptional()
  @IsString({
    message: 'La firma del solicitante debe ser una cadena de texto',
  })
  firmaSolicitante?: string;

  /* ----- Recomendación 1 ----- */

  @ApiProperty({
    example: 'Carlos Alberto Mora Chaves',
    description: 'Nombre del recomendante 1',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El nombre del recomendante 1 es obligatorio' })
  @IsString({
    message: 'El nombre del recomendante 1 debe ser una cadena de texto',
  })
  @MaxLength(150, {
    message: 'El nombre del recomendante 1 no puede exceder 150 caracteres',
  })
  recomendacion1Nombre: string;

  @ApiProperty({
    example: '1-0987-6543',
    description: 'Identificación del recomendante 1',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'La identificación del recomendante 1 es obligatoria',
  })
  @IsString({
    message:
      'La identificación del recomendante 1 debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message:
      'La identificación del recomendante 1 no puede exceder 30 caracteres',
  })
  recomendacion1Identificacion: string;

  @ApiProperty({
    example: '12045',
    description: 'Número de abonado del recomendante 1',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'El número de abonado del recomendante 1 es obligatorio',
  })
  @IsString({
    message:
      'El número de abonado del recomendante 1 debe ser una cadena de texto',
  })
  @MaxLength(50, {
    message:
      'El número de abonado del recomendante 1 no puede exceder 50 caracteres',
  })
  recomendacion1NumeroAbonado: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description: 'Firma del recomendante 1 (data-URL o URL/ruta)',
  })
  @IsOptional()
  @IsString({
    message: 'La firma del recomendante 1 debe ser una cadena de texto',
  })
  recomendacion1Firma?: string;

  /* ----- Recomendación 2 ----- */

  @ApiProperty({
    example: 'Ana Lucía Vargas Quirós',
    description: 'Nombre del recomendante 2',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El nombre del recomendante 2 es obligatorio' })
  @IsString({
    message: 'El nombre del recomendante 2 debe ser una cadena de texto',
  })
  @MaxLength(150, {
    message: 'El nombre del recomendante 2 no puede exceder 150 caracteres',
  })
  recomendacion2Nombre: string;

  @ApiProperty({
    example: '1-2345-6789',
    description: 'Identificación del recomendante 2',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'La identificación del recomendante 2 es obligatoria',
  })
  @IsString({
    message:
      'La identificación del recomendante 2 debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message:
      'La identificación del recomendante 2 no puede exceder 30 caracteres',
  })
  recomendacion2Identificacion: string;

  @ApiProperty({
    example: '13088',
    description: 'Número de abonado del recomendante 2',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'El número de abonado del recomendante 2 es obligatorio',
  })
  @IsString({
    message:
      'El número de abonado del recomendante 2 debe ser una cadena de texto',
  })
  @MaxLength(50, {
    message:
      'El número de abonado del recomendante 2 no puede exceder 50 caracteres',
  })
  recomendacion2NumeroAbonado: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description: 'Firma del recomendante 2 (data-URL o URL/ruta)',
  })
  @IsOptional()
  @IsString({
    message: 'La firma del recomendante 2 debe ser una cadena de texto',
  })
  recomendacion2Firma?: string;
}
