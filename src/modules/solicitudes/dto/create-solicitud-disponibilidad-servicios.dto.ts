import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
  NATURALEZAS_INMUEBLE_CAMBIO_TITULAR,
  NaturalezaInmuebleCambioTitular,
} from '../../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import {
  PROPOSITOS_DISPONIBILIDAD_SERVICIOS_CONFIRMADOS,
  PropositoDisponibilidadServiciosConfirmado,
} from '../../../common/enums/proposito-disponibilidad-servicios.enum';
import {
  TIPOS_PERSONA_DISPONIBILIDAD_SERVICIOS,
  TipoPersonaDisponibilidadServicios,
} from '../../../common/enums/tipo-persona-disponibilidad-servicios.enum';
import { DocumentoSolicitudReferenciaDto } from './documento-solicitud-referencia.dto';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Solo acepta boolean nativo; no convierte "1"/"0"/1/0 silenciosamente. */
const strictBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === false) {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
};

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === '' || value === null) {
    return undefined;
  }
  return typeof value === 'string' ? value.trim() : value;
};

const esPersonaFisica = (o: CreateSolicitudDisponibilidadServiciosDto) =>
  o.tipoPersona === TipoPersonaDisponibilidadServicios.FISICA;

const esPersonaJuridica = (o: CreateSolicitudDisponibilidadServiciosDto) =>
  o.tipoPersona === TipoPersonaDisponibilidadServicios.JURIDICA;

/**
 * DTO público para registrar
 * «Constancia de Disponibilidad de Servicios».
 * Solo campos del formulario ciudadano (sin datos administrativos).
 *
 * Condicionales estructurales (class-validator):
 * - Persona física → nombre/apellidos/ID/teléfono.
 * - Persona jurídica → razón social, ID jurídica, representante.
 *
 * Reglas de negocio (propósito, planos, documentos, naturaleza):
 * se aplican en SolicitudesService.
 *
 * descripcionProyecto: siempre obligatoria (criterio de aceptación 4.8.2).
 * lista completa de propósitos PDF: BLOCKED — solo enum confirmado FE.
 */
export class CreateSolicitudDisponibilidadServiciosDto {
  @ApiProperty({
    example: TipoPersonaDisponibilidadServicios.FISICA,
    enum: TipoPersonaDisponibilidadServicios,
    description: 'Tipo de persona del titular',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El tipo de persona es obligatorio' })
  @IsEnum(TipoPersonaDisponibilidadServicios, {
    message: `El tipo de persona no es válido. Opciones permitidas: ${TIPOS_PERSONA_DISPONIBILIDAD_SERVICIOS.join(', ')}`,
  })
  tipoPersona: TipoPersonaDisponibilidadServicios;

  /* ----- Persona física ----- */

  @ApiPropertyOptional({
    example: 'María Elena',
    description: 'Nombre del titular (requerido si Persona física)',
    maxLength: 100,
  })
  @ValidateIf(esPersonaFisica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'El nombre (persona física) es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombreFisica?: string;

  @ApiPropertyOptional({
    example: 'Rodríguez',
    description: 'Primer apellido (requerido si Persona física)',
    maxLength: 100,
  })
  @ValidateIf(esPersonaFisica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'El primer apellido es obligatorio' })
  @IsString({ message: 'El primer apellido debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'El primer apellido no puede exceder 100 caracteres',
  })
  primerApellidoFisica?: string;

  @ApiPropertyOptional({
    example: 'Vargas',
    description: 'Segundo apellido (requerido si Persona física)',
    maxLength: 100,
  })
  @ValidateIf(esPersonaFisica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'El segundo apellido es obligatorio' })
  @IsString({ message: 'El segundo apellido debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'El segundo apellido no puede exceder 100 caracteres',
  })
  segundoApellidoFisica?: string;

  @ApiPropertyOptional({
    example: '1-1234-0567',
    description: 'Identificación (requerido si Persona física)',
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
    description: 'Teléfono (requerido si Persona física)',
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
    description: 'Identificación jurídica (requerido si Persona jurídica)',
    maxLength: 30,
  })
  @ValidateIf(esPersonaJuridica)
  @Transform(trimString)
  @IsNotEmpty({ message: 'La identificación jurídica es obligatoria' })
  @IsString({
    message: 'La identificación jurídica debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message: 'La identificación jurídica no puede exceder 30 caracteres',
  })
  identificacionJuridica?: string;

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
      'Destino del medio principal. Si el medio es Correo, el service valida formato email.',
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

  /* ----- Ubicación ----- */

  @ApiProperty({ example: 'San José', maxLength: 80 })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La provincia es obligatoria' })
  @IsString({ message: 'La provincia debe ser una cadena de texto' })
  @MaxLength(80, { message: 'La provincia no puede exceder 80 caracteres' })
  provincia: string;

  @ApiProperty({ example: 'Pérez Zeledón', maxLength: 80 })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El cantón es obligatorio' })
  @IsString({ message: 'El cantón debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El cantón no puede exceder 80 caracteres' })
  canton: string;

  @ApiProperty({ example: 'San Isidro de El General', maxLength: 80 })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El distrito es obligatorio' })
  @IsString({ message: 'El distrito debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El distrito no puede exceder 80 caracteres' })
  distrito: string;

  @ApiProperty({
    example: '100 m norte de la iglesia, costado oeste',
    maxLength: 500,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La dirección exacta es obligatoria' })
  @IsString({ message: 'La dirección exacta debe ser una cadena de texto' })
  @MaxLength(500, {
    message: 'La dirección exacta no puede exceder 500 caracteres',
  })
  direccionExacta: string;

  /* ----- Inmueble ----- */

  @ApiPropertyOptional({
    example: '123456-000',
    description: 'Folio real (opcional)',
    maxLength: 50,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString({ message: 'El folio real debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El folio real no puede exceder 50 caracteres' })
  folioReal?: string;

  @ApiPropertyOptional({
    example: 'SJ-1234567-2020',
    description: 'Referencia textual del plano catastrado',
    maxLength: 50,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString({ message: 'El plano catastrado debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'El plano catastrado no puede exceder 50 caracteres',
  })
  planoCatastrado?: string;

  @ApiPropertyOptional({
    example: 'AG-998877-2019',
    description:
      'Referencia textual del plano de agrimensura (obligatorio si no hay plano catastrado — regla FE)',
    maxLength: 50,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString({
    message: 'El plano de agrimensura debe ser una cadena de texto',
  })
  @MaxLength(50, {
    message: 'El plano de agrimensura no puede exceder 50 caracteres',
  })
  planoAgrimensura?: string;

  @ApiPropertyOptional({
    example: 'NIS-45892',
    description:
      'NIS (texto). Opcional: la constancia puede solicitarse antes de existir servicio.',
    maxLength: 50,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString({ message: 'El NIS debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El NIS no puede exceder 50 caracteres' })
  nis?: string;

  @ApiProperty({
    example: NaturalezaInmuebleCambioTitular.INSCRITO,
    enum: NaturalezaInmuebleCambioTitular,
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
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La calidad del titular es obligatoria' })
  @IsEnum(CalidadTitularCambioTitular, {
    message: `La calidad del titular no es válida. Opciones permitidas: ${CALIDADES_TITULAR_CAMBIO_TITULAR.join(', ')}`,
  })
  calidadTitular: CalidadTitularCambioTitular;

  @ApiProperty({
    example: PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
    enum: PropositoDisponibilidadServiciosConfirmado,
    description:
      'Propósito (solo opciones confirmadas en el repositorio; lista PDF BLOCKED)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'El propósito es obligatorio' })
  @IsEnum(PropositoDisponibilidadServiciosConfirmado, {
    message: `El propósito no es válido. Opciones permitidas: ${PROPOSITOS_DISPONIBILIDAD_SERVICIOS_CONFIRMADOS.join(', ')}`,
  })
  proposito: PropositoDisponibilidadServiciosConfirmado;

  @ApiPropertyOptional({
    example: 'DISP-2024-00123',
    description:
      'Número de disponibilidad anterior. Condición de obligatoriedad: BLOCKED (PDF). Si se envía, se valida como texto.',
    maxLength: 50,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString({
    message:
      'El número de disponibilidad anterior debe ser una cadena de texto',
  })
  @MaxLength(50, {
    message:
      'El número de disponibilidad anterior no puede exceder 50 caracteres',
  })
  numeroDisponibilidadAnterior?: string;

  /* ----- Proyecto ----- */

  @ApiProperty({
    example: 'Construcción de 4 unidades habitacionales de dos niveles',
    description: 'Descripción del proyecto (siempre obligatoria)',
    maxLength: 2000,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La descripción del proyecto es obligatoria' })
  @IsString({
    message: 'La descripción del proyecto debe ser una cadena de texto',
  })
  @MaxLength(2000, {
    message: 'La descripción del proyecto no puede exceder 2000 caracteres',
  })
  descripcionProyecto: string;

  @ApiPropertyOptional({ example: 3, description: 'Cantidad de dormitorios' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad de dormitorios debe ser un entero' })
  @Min(0, { message: 'La cantidad de dormitorios no puede ser negativa' })
  cantidadDormitorios?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Las unidades habitacionales deben ser un entero' })
  @Min(0, {
    message: 'Las unidades habitacionales no pueden ser negativas',
  })
  unidadesHabitacionales?: number;

  @ApiPropertyOptional({
    example: 185.5,
    description: 'Área de construcción (decimal). Unidad oficial BLOCKED.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El área de construcción debe ser un número con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El área de construcción no puede ser negativa' })
  areaConstruccion?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los niveles deben ser un entero' })
  @Min(0, { message: 'Los niveles no pueden ser negativos' })
  niveles?: number;

  @ApiPropertyOptional({
    example: 0.75,
    description: 'Caudal requerido (decimal). Unidad oficial BLOCKED.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    {
      message: 'El caudal requerido debe ser un número con hasta 4 decimales',
    },
  )
  @Min(0, { message: 'El caudal requerido no puede ser negativo' })
  caudalRequerido?: number;

  @ApiProperty({
    example: true,
    description: 'Autorización de inspección (boolean requerido)',
  })
  @Transform(strictBoolean)
  @IsBoolean({
    message: 'La autorización de inspección debe ser un valor booleano',
  })
  autorizacionInspeccion: boolean;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description: 'Firma (data-URL o URL). Opcional.',
  })
  @IsOptional()
  @IsString({ message: 'La firma debe ser una cadena de texto' })
  firma?: string;

  @ApiProperty({
    description:
      'Referencias a adjuntos previos (POST /solicitudes/documentos). id + tokenReclamo.',
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
