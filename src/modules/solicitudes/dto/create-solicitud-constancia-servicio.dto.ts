import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CALIDADES_TITULAR_CAMBIO_TITULAR,
  CalidadTitularCambioTitular,
} from '../../../common/enums/calidad-titular-cambio-titular.enum';
import {
  MEDIOS_NOTIFICACION_CAMBIO_TITULAR,
  MedioNotificacionCambioTitular,
} from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import {
  isMotivoOtro,
  MotivoConstanciaServicio,
  MOTIVOS_CONSTANCIA_SERVICIO,
} from '../../../common/enums/motivo-constancia-servicio.enum';
import {
  NATURALEZAS_INMUEBLE_CAMBIO_TITULAR,
  NaturalezaInmuebleCambioTitular,
} from '../../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { DocumentoSolicitudReferenciaDto } from './documento-solicitud-referencia.dto';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const esMotivoOtro = (o: CreateSolicitudConstanciaServicioDto) =>
  isMotivoOtro(o?.motivo);

/**
 * DTO público para registrar una solicitud de «Constancia de Servicio Existente».
 * Solo incluye los campos ciudadanos del formulario (sin campos administrativos).
 */
export class CreateSolicitudConstanciaServicioDto {
  /* ----- Datos del servicio ----- */

  @ApiProperty({
    example: 'Domiciliar',
    description: 'Tipo de servicio (e.g. Domiciliar, Comercial, Empresarial)',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El tipo de servicio es obligatorio' })
  @IsString({ message: 'El tipo de servicio debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'El tipo de servicio no puede exceder 100 caracteres',
  })
  tipoServicio: string;

  @ApiProperty({
    example: 'NIS-45892',
    description: 'Número de Identificación del Servicio (NIS)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El NIS es obligatorio' })
  @IsString({ message: 'El NIS debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El NIS no puede exceder 50 caracteres' })
  nis: string;

  /* ----- Propietario e Inmueble ----- */

  @ApiProperty({
    example: 'María Elena Rodríguez Vargas',
    description: 'Nombre completo o razón social del propietario del inmueble',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'El nombre del propietario del inmueble es obligatorio',
  })
  @IsString({
    message: 'El nombre del propietario del inmueble debe ser una cadena de texto',
  })
  @MaxLength(150, {
    message: 'El nombre del propietario no puede exceder 150 caracteres',
  })
  propietarioInmueble: string;

  @ApiProperty({
    example: 'Carlos Alberto Mora Jiménez',
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
    description: 'Identificación del solicitante (cédula, DIMEX o pasaporte)',
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
    example: 'carlos.mora@ejemplo.com',
    description: 'Correo electrónico de contacto del solicitante',
    maxLength: 150,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @IsEmail(
    {},
    { message: 'El correo electrónico no tiene un formato válido' },
  )
  @MaxLength(150, {
    message: 'El correo electrónico no puede exceder 150 caracteres',
  })
  correoElectronico: string;

  @ApiProperty({
    example: '8888-1234',
    description: 'Teléfono de contacto del solicitante',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(30, { message: 'El teléfono no puede exceder 30 caracteres' })
  telefono: string;

  /* ----- Inmueble ----- */

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
    description: 'Naturaleza del inmueble (Inscrito | Sin inscribir)',
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
    description: 'Calidad del titular (Propietario | Poseedor | Representante legal)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La calidad del titular es obligatoria' })
  @IsEnum(CalidadTitularCambioTitular, {
    message: `La calidad del titular no es válida. Opciones permitidas: ${CALIDADES_TITULAR_CAMBIO_TITULAR.join(', ')}`,
  })
  calidadTitular: CalidadTitularCambioTitular;

  /* ----- Ubicación ----- */

  @ApiProperty({
    example: 'San José',
    description: 'Provincia donde se ubica el inmueble',
    maxLength: 80,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La provincia es obligatoria' })
  @IsString({ message: 'La provincia debe ser una cadena de texto' })
  @MaxLength(80, { message: 'La provincia no puede exceder 80 caracteres' })
  provincia: string;

  @ApiProperty({
    example: 'Pérez Zeledón',
    description: 'Cantón donde se ubica el inmueble',
    maxLength: 80,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El cantón es obligatorio' })
  @IsString({ message: 'El cantón debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El cantón no puede exceder 80 caracteres' })
  canton: string;

  @ApiProperty({
    example: 'San Isidro de El General',
    description: 'Distrito donde se ubica el inmueble',
    maxLength: 80,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El distrito es obligatorio' })
  @IsString({ message: 'El distrito debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El distrito no puede exceder 80 caracteres' })
  distrito: string;

  @ApiProperty({
    example: '100 m norte de la iglesia, casa blanca esquinera',
    description: 'Dirección exacta del inmueble',
    maxLength: 500,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La dirección exacta es obligatoria' })
  @IsString({ message: 'La dirección exacta debe ser una cadena de texto' })
  @MaxLength(500, {
    message: 'La dirección exacta no puede exceder 500 caracteres',
  })
  direccionExacta: string;

  /* ----- Motivo y Trámite ----- */

  @ApiProperty({
    example: MotivoConstanciaServicio.BONO_VIVIENDA,
    enum: MotivoConstanciaServicio,
    description: 'Motivo por el cual solicita la constancia de servicio',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @IsEnum(MotivoConstanciaServicio, {
    message: `El motivo no es válido. Opciones permitidas: ${MOTIVOS_CONSTANCIA_SERVICIO.join(', ')}`,
  })
  motivo: MotivoConstanciaServicio;

  @ApiPropertyOptional({
    example: 'Trámite especial ante IMAS para subsidio familiar',
    description:
      'Descripción detallada obligatoria cuando el motivo seleccionado es "Otro"',
    maxLength: 255,
  })
  @ValidateIf(esMotivoOtro)
  @Transform(trimString)
  @IsNotEmpty({
    message: 'Debe especificar el motivo cuando selecciona la opción Otro',
  })
  @IsString({
    message: 'El detalle de otro motivo debe ser una cadena de texto',
  })
  @MaxLength(255, {
    message: 'El detalle de otro motivo no puede exceder 255 caracteres',
  })
  otroMotivo?: string;

  @ApiPropertyOptional({
    example: 'Solicitud de bono de vivienda BANHVI',
    description: 'Descripción o especificación del trámite por realizar',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El trámite por realizar debe ser una cadena de texto' })
  @MaxLength(255, {
    message: 'El trámite por realizar no puede exceder 255 caracteres',
  })
  tramitePorRealizar?: string;

  /* ----- Notificaciones ----- */

  @ApiProperty({
    example: MedioNotificacionCambioTitular.CORREO,
    enum: MedioNotificacionCambioTitular,
    description: 'Medio de notificación principal preferido',
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
    description: 'Medio de notificación secundario alternativo (opcional)',
  })
  @Transform(trimString)
  @IsOptional()
  @IsEnum(MedioNotificacionCambioTitular, {
    message: `El medio de notificación secundario no es válido. Opciones permitidas: ${MEDIOS_NOTIFICACION_CAMBIO_TITULAR.join(', ')}`,
  })
  medioNotificacionSecundario?: MedioNotificacionCambioTitular;

  /* ----- Firma y Documentos ----- */

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma del solicitante (data-URL en base64 o URL de archivo). Opcional.',
  })
  @IsOptional()
  @IsString({ message: 'La firma debe ser una cadena de texto' })
  firma?: string;

  @ApiPropertyOptional({
    type: [DocumentoSolicitudReferenciaDto],
    description: 'Referencias a documentos previamente cargados (opcional)',
  })
  @IsOptional()
  @IsArray({ message: 'Los documentos deben enviarse como una lista' })
  @ValidateNested({ each: true })
  @Type(() => DocumentoSolicitudReferenciaDto)
  documentos?: DocumentoSolicitudReferenciaDto[];
}
