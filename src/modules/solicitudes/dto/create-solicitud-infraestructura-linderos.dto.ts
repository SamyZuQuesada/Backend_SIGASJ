import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
  PROPOSITOS_INFRAESTRUCTURA_LINDEROS_CONFIRMADOS,
  PropositoInfraestructuraLinderosConfirmado,
} from '../../../common/enums/proposito-infraestructura-linderos.enum';
import {
  TIPOS_PERSONA_INFRAESTRUCTURA_LINDEROS,
  TipoPersonaInfraestructuraLinderos,
} from '../../../common/enums/tipo-persona-infraestructura-linderos.enum';
import { DocumentoSolicitudReferenciaDto } from './documento-solicitud-referencia.dto';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const esPersonaFisica = (o: CreateSolicitudInfraestructuraLinderosDto) =>
  o.tipoPersona === TipoPersonaInfraestructuraLinderos.FISICA;

const esPersonaJuridica = (o: CreateSolicitudInfraestructuraLinderosDto) =>
  o.tipoPersona === TipoPersonaInfraestructuraLinderos.JURIDICA;

const esReunionFincas = (o: CreateSolicitudInfraestructuraLinderosDto) =>
  o.proposito === PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS;

/**
 * DTO público para registrar
 * «Constancia de Infraestructura Frente a Linderos de un Inmueble».
 * Solo campos del formulario ciudadano (sin datos administrativos).
 *
 * Condicionales:
 * - Persona física → nombre/apellidos/ID/teléfono física.
 * - Persona jurídica → razón social, cédula, representante.
 * - Propósito «Reunión de fincas» → planoAgrimensura obligatorio
 *   (documentRequirementsConfig frontend / enum confirmado).
 */
export class CreateSolicitudInfraestructuraLinderosDto {
  @ApiProperty({
    example: 'NIS-77881',
    description: 'NIS / número de servicio (identificador textual)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El NIS es obligatorio' })
  @IsString({ message: 'El NIS debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El NIS no puede exceder 50 caracteres' })
  nis: string;

  @ApiProperty({
    example: TipoPersonaInfraestructuraLinderos.FISICA,
    enum: TipoPersonaInfraestructuraLinderos,
    description: 'Tipo de persona del propietario',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El tipo de persona es obligatorio' })
  @IsEnum(TipoPersonaInfraestructuraLinderos, {
    message: `El tipo de persona no es válido. Opciones permitidas: ${TIPOS_PERSONA_INFRAESTRUCTURA_LINDEROS.join(', ')}`,
  })
  tipoPersona: TipoPersonaInfraestructuraLinderos;

  /* ----- Persona física ----- */

  @ApiPropertyOptional({
    example: 'María Elena',
    description: 'Nombre del propietario (requerido si Persona física)',
    maxLength: 100,
  })
  @ValidateIf(esPersonaFisica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'El nombre (persona física) es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombreFisica?: string;

  @ApiPropertyOptional({
    example: 'Rodríguez Vargas',
    description: 'Apellidos del propietario (requerido si Persona física)',
    maxLength: 100,
  })
  @ValidateIf(esPersonaFisica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'Los apellidos (persona física) son obligatorios' })
  @IsString({ message: 'Los apellidos deben ser una cadena de texto' })
  @MaxLength(100, { message: 'Los apellidos no pueden exceder 100 caracteres' })
  apellidosFisica?: string;

  @ApiPropertyOptional({
    example: '1-1234-0567',
    description: 'Identificación del propietario (requerido si Persona física)',
    maxLength: 30,
  })
  @ValidateIf(esPersonaFisica)
  @Transform(trimString)
  @IsNotEmpty({
    message: 'La identificación (persona física) es obligatoria',
  })
  @IsString({ message: 'La identificación debe ser una cadena de texto' })
  @MaxLength(30, {
    message: 'La identificación no puede exceder 30 caracteres',
  })
  identificacionFisica?: string;

  @ApiPropertyOptional({
    example: '8888-1234',
    description: 'Teléfono del propietario (requerido si Persona física)',
    maxLength: 30,
  })
  @ValidateIf(esPersonaFisica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'El teléfono (persona física) es obligatorio' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(30, { message: 'El teléfono no puede exceder 30 caracteres' })
  telefonoFisica?: string;

  /* ----- Persona jurídica ----- */

  @ApiPropertyOptional({
    example: 'Inversiones del Valle S.A.',
    description: 'Razón social (requerido si Persona jurídica)',
    maxLength: 200,
  })
  @ValidateIf(esPersonaJuridica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  @IsString({ message: 'La razón social debe ser una cadena de texto' })
  @MaxLength(200, {
    message: 'La razón social no puede exceder 200 caracteres',
  })
  razonSocial?: string;

  @ApiPropertyOptional({
    example: '3-101-123456',
    description: 'Cédula jurídica (requerido si Persona jurídica)',
    maxLength: 30,
  })
  @ValidateIf(esPersonaJuridica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'La cédula jurídica es obligatoria' })
  @IsString({ message: 'La cédula jurídica debe ser una cadena de texto' })
  @MaxLength(30, {
    message: 'La cédula jurídica no puede exceder 30 caracteres',
  })
  cedulaJuridica?: string;

  @ApiPropertyOptional({
    example: 'Luis Alberto Mora Chaves',
    description:
      'Nombre del representante legal (requerido si Persona jurídica)',
    maxLength: 150,
  })
  @ValidateIf(esPersonaJuridica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'El nombre del representante es obligatorio' })
  @IsString({
    message: 'El nombre del representante debe ser una cadena de texto',
  })
  @MaxLength(150, {
    message: 'El nombre del representante no puede exceder 150 caracteres',
  })
  nombreRepresentante?: string;

  @ApiPropertyOptional({
    example: '1-0987-6543',
    description:
      'Identificación del representante (requerido si Persona jurídica)',
    maxLength: 30,
  })
  @ValidateIf(esPersonaJuridica)
  @Transform(trimString)
  @IsNotEmpty({
    message: 'La identificación del representante es obligatoria',
  })
  @IsString({
    message: 'La identificación del representante debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message:
      'La identificación del representante no puede exceder 30 caracteres',
  })
  identificacionRepresentante?: string;

  @ApiPropertyOptional({
    example: '8777-4321',
    description: 'Teléfono del representante (requerido si Persona jurídica)',
    maxLength: 30,
  })
  @ValidateIf(esPersonaJuridica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'El teléfono del representante es obligatorio' })
  @IsString({
    message: 'El teléfono del representante debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message: 'El teléfono del representante no puede exceder 30 caracteres',
  })
  telefonoRepresentante?: string;

  @ApiProperty({
    example: CalidadTitularCambioTitular.PROPIETARIO,
    enum: CalidadTitularCambioTitular,
    description: 'Calidad del titular (opciones ASADA oficiales)',
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
    description: 'Provincia del inmueble (texto libre)',
    maxLength: 80,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La provincia es obligatoria' })
  @IsString({ message: 'La provincia debe ser una cadena de texto' })
  @MaxLength(80, { message: 'La provincia no puede exceder 80 caracteres' })
  provincia: string;

  @ApiProperty({
    example: 'Pérez Zeledón',
    description: 'Cantón del inmueble (texto libre)',
    maxLength: 80,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El cantón es obligatorio' })
  @IsString({ message: 'El cantón debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El cantón no puede exceder 80 caracteres' })
  canton: string;

  @ApiProperty({
    example: 'San Isidro de El General',
    description: 'Distrito del inmueble (texto libre)',
    maxLength: 80,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El distrito es obligatorio' })
  @IsString({ message: 'El distrito debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El distrito no puede exceder 80 caracteres' })
  distrito: string;

  @ApiProperty({
    example: '100 m norte de la iglesia, costado oeste',
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

  /* ----- Inmueble / planos ----- */

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

  @ApiProperty({
    example: 'SJ-1234567-2020',
    description:
      'Referencia del plano catastrado (requerido: documentRequirementsConfig)',
    maxLength: 50,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El plano catastrado es obligatorio' })
  @IsString({ message: 'El plano catastrado debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'El plano catastrado no puede exceder 50 caracteres',
  })
  planoCatastrado: string;

  @ApiPropertyOptional({
    example: 'AG-998877-2019',
    description:
      'Referencia del plano de agrimensura (obligatorio si propósito es Reunión de fincas)',
    maxLength: 50,
  })
  @ValidateIf(esReunionFincas)
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsNotEmpty({
    message:
      'El plano de agrimensura es obligatorio cuando el propósito es Reunión de fincas',
  })
  @IsString({
    message: 'El plano de agrimensura debe ser una cadena de texto',
  })
  @MaxLength(50, {
    message: 'El plano de agrimensura no puede exceder 50 caracteres',
  })
  planoAgrimensura?: string;

  @ApiProperty({
    example: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
    enum: PropositoInfraestructuraLinderosConfirmado,
    description:
      'Propósito de la constancia (solo opciones confirmadas en el repositorio)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El propósito es obligatorio' })
  @IsEnum(PropositoInfraestructuraLinderosConfirmado, {
    message: `El propósito no es válido. Opciones permitidas: ${PROPOSITOS_INFRAESTRUCTURA_LINDEROS_CONFIRMADOS.join(', ')}`,
  })
  proposito: PropositoInfraestructuraLinderosConfirmado;

  /* ----- Notificaciones ----- */

  @ApiProperty({
    example: MedioNotificacionCambioTitular.CORREO,
    enum: MedioNotificacionCambioTitular,
    description: 'Medio de notificación principal',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El medio de notificación principal es obligatorio' })
  @IsEnum(MedioNotificacionCambioTitular, {
    message: `El medio de notificación principal no es válido. Opciones permitidas: ${MEDIOS_NOTIFICACION_CAMBIO_TITULAR.join(', ')}`,
  })
  medioNotificacionPrincipal: MedioNotificacionCambioTitular;

  @ApiPropertyOptional({
    example: 'maria@ejemplo.com',
    description:
      'Destino del medio principal (correo, teléfono o dirección). Si el medio es Correo, el service valida formato email.',
    maxLength: 200,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({
    message: 'El valor de notificación principal debe ser una cadena de texto',
  })
  @MaxLength(200, {
    message:
      'El valor de notificación principal no puede exceder 200 caracteres',
  })
  valorNotificacionPrincipal?: string;

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
    example: '8888-1234',
    description: 'Destino del medio secundario',
    maxLength: 200,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({
    message: 'El valor de notificación secundario debe ser una cadena de texto',
  })
  @MaxLength(200, {
    message:
      'El valor de notificación secundario no puede exceder 200 caracteres',
  })
  valorNotificacionSecundario?: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description:
      'Firma del solicitante (data-URL base64 o URL de archivo). Opcional.',
  })
  @IsOptional()
  @IsString({ message: 'La firma debe ser una cadena de texto' })
  firma?: string;

  @ApiProperty({
    description:
      'Referencias a adjuntos previamente subidos vía POST /solicitudes/documentos (id + tokenReclamo). No enviar File/Blob.',
    type: () => DocumentoSolicitudReferenciaDto,
    isArray: true,
  })
  @IsArray({ message: 'Los documentos deben enviarse como un arreglo' })
  @ArrayMinSize(1, {
    message: 'Debe adjuntar al menos un documento requerido',
  })
  @ValidateNested({ each: true })
  @Type(() => DocumentoSolicitudReferenciaDto)
  documentos: DocumentoSolicitudReferenciaDto[];
}
