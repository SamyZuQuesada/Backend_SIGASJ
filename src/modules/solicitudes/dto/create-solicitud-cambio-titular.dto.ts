import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DocumentoSolicitudReferenciaDto } from './documento-solicitud-referencia.dto';
import {
  CALIDADES_TITULAR_CAMBIO_TITULAR,
  CalidadTitularCambioTitular,
} from '../../../common/enums/calidad-titular-cambio-titular.enum';
import {
  MEDIOS_NOTIFICACION_CAMBIO_TITULAR,
  MedioNotificacionCambioTitular,
} from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import {
  NATURALEZAS_INMUEBLE_CAMBIO_TITULAR,
  NaturalezaInmuebleCambioTitular,
} from '../../../common/enums/naturaleza-inmueble-cambio-titular.enum';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * DTO público para registrar un Cambio de Nombre del Titular del Servicio.
 * Solo incluye campos del formulario ciudadano (sin datos administrativos).
 */
export class CreateSolicitudCambioTitularDto {
  @ApiProperty({
    example: 'Ana Lucía Vargas Quirós',
    description: 'Nombre completo del solicitante',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El nombre del solicitante es obligatorio' })
  @IsString({
    message: 'El nombre del solicitante debe ser una cadena de texto',
  })
  @MaxLength(150, {
    message: 'El nombre del solicitante no puede exceder 150 caracteres',
  })
  nombreSolicitante: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Identificación del solicitante (texto; admite guiones)',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La identificación del solicitante es obligatoria' })
  @IsString({
    message: 'La identificación del solicitante debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message: 'La identificación del solicitante no puede exceder 30 caracteres',
  })
  identificacionSolicitante: string;

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
    example: 'Carlos Alberto Mora Jiménez',
    description: 'Nombre completo del propietario registral',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'El nombre del propietario registral es obligatorio',
  })
  @IsString({
    message: 'El nombre del propietario registral debe ser una cadena de texto',
  })
  @MaxLength(150, {
    message:
      'El nombre del propietario registral no puede exceder 150 caracteres',
  })
  nombrePropietarioRegistral: string;

  @ApiProperty({
    example: '1-0987-6543',
    description: 'Identificación del propietario registral',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'La identificación del propietario es obligatoria',
  })
  @IsString({
    message: 'La identificación del propietario debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message: 'La identificación del propietario no puede exceder 30 caracteres',
  })
  identificacionPropietario: string;

  @ApiPropertyOptional({
    example: '123456-000',
    description: 'Folio real del inmueble (opcional si no está inscrito)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El folio real debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El folio real no puede exceder 50 caracteres' })
  folioReal?: string;

  @ApiPropertyOptional({
    example: 'SJ-1234567-2020',
    description: 'Código del plano catastrado (opcional)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El plano catastrado debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'El plano catastrado no puede exceder 50 caracteres',
  })
  planoCatastrado?: string;

  @ApiPropertyOptional({
    example: 'AG-998877-2019',
    description: 'Código del plano de agrimensura (opcional)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El plano de agrimensura debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'El plano de agrimensura no puede exceder 50 caracteres',
  })
  planoAgrimensura?: string;

  @ApiProperty({
    example: NaturalezaInmuebleCambioTitular.INSCRITO,
    enum: NaturalezaInmuebleCambioTitular,
    description: 'Naturaleza del inmueble (solo opciones oficiales)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La naturaleza del inmueble es obligatoria' })
  @IsEnum(NaturalezaInmuebleCambioTitular, {
    message: `La naturaleza del inmueble no es válida. Opciones permitidas: ${NATURALEZAS_INMUEBLE_CAMBIO_TITULAR.join(', ')}`,
  })
  naturalezaInmueble: NaturalezaInmuebleCambioTitular;

  @ApiProperty({
    example: CalidadTitularCambioTitular.PROPIETARIO,
    enum: CalidadTitularCambioTitular,
    description: 'Calidad del titular (solo opciones oficiales)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La calidad del titular es obligatoria' })
  @IsEnum(CalidadTitularCambioTitular, {
    message: `La calidad del titular no es válida. Opciones permitidas: ${CALIDADES_TITULAR_CAMBIO_TITULAR.join(', ')}`,
  })
  calidadTitular: CalidadTitularCambioTitular;

  @ApiProperty({
    example: 'NIS-45892',
    description: 'NIS / número de servicio (identificador textual)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El NIS es obligatorio' })
  @IsString({ message: 'El NIS debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El NIS no puede exceder 50 caracteres' })
  nis: string;

  @ApiProperty({
    example: 'Carlos Alberto Mora Jiménez',
    description: 'Nombre a quien aparece asociada la facturación actual',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El campo facturaANombreDe es obligatorio' })
  @IsString({ message: 'facturaANombreDe debe ser una cadena de texto' })
  @MaxLength(150, {
    message: 'facturaANombreDe no puede exceder 150 caracteres',
  })
  facturaANombreDe: string;

  @ApiProperty({
    example: MedioNotificacionCambioTitular.CORREO,
    enum: MedioNotificacionCambioTitular,
    description: 'Medio de notificación principal (solo opciones oficiales)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El medio de notificación principal es obligatorio' })
  @IsEnum(MedioNotificacionCambioTitular, {
    message: `El medio de notificación principal no es válido. Opciones permitidas: ${MEDIOS_NOTIFICACION_CAMBIO_TITULAR.join(', ')}`,
  })
  medioNotificacionPrincipal: MedioNotificacionCambioTitular;

  @ApiPropertyOptional({
    example: MedioNotificacionCambioTitular.TELEFONO,
    enum: MedioNotificacionCambioTitular,
    description: 'Medio de notificación secundario (opcional)',
  })
  @Transform(trimString)
  @IsOptional()
  @IsEnum(MedioNotificacionCambioTitular, {
    message: `El medio de notificación secundario no es válido. Opciones permitidas: ${MEDIOS_NOTIFICACION_CAMBIO_TITULAR.join(', ')}`,
  })
  medioNotificacionSecundario?: MedioNotificacionCambioTitular;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma del solicitante (data-URL base64 o URL de archivo). Opcional.',
  })
  @IsOptional()
  @IsString({ message: 'La firma debe ser una cadena de texto' })
  firma?: string;

  @ApiPropertyOptional({
    type: () => [DocumentoSolicitudReferenciaDto],
    description:
      'Referencias a documentos adjuntos cargados previamente (upload + token)',
  })
  @IsOptional()
  @IsArray({ message: 'Los documentos deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => DocumentoSolicitudReferenciaDto)
  documentos?: DocumentoSolicitudReferenciaDto[];
}
