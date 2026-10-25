import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { IsFechaActividadValida } from '../../../common/validators/is-fecha-actividad-valida.validator';

const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@ValidatorConstraint({ name: 'periodoActividadValido', async: false })
class PeriodoActividadValidoConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const dto = args.object as CreateActividadDto;
    const inicio = dto.fechaActividad?.trim();
    const fin = dto.fechaFin?.trim();
    const horaInicio = dto.horaInicio?.trim();
    const horaFin = dto.horaFin?.trim();
    if (!inicio || !fin || !horaInicio || !horaFin) {
      return true;
    }
    if (fin < inicio) {
      return false;
    }
    if (fin === inicio && horaFin <= horaInicio) {
      return false;
    }
    return true;
  }

  defaultMessage() {
    return 'La finalización no puede ser anterior al inicio de la actividad';
  }
}

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const trimString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim() : raw;
};

const toFechaCalendario = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const year = raw.getUTCFullYear();
    const month = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const day = String(raw.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return iso ? iso[1] : trimmed;
};

const normalizeHora = (params: TransformFnParams): unknown => {
  const raw = trimString(params);
  if (typeof raw !== 'string') {
    return raw;
  }
  const match = /^([01]\d|2[0-3]):[0-5]\d/.exec(raw);
  return match ? raw.slice(0, 5) : raw;
};

const trimOptionalString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
};

const parseOptionalJsonObject = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const toInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    return Number.parseInt(raw.trim(), 10);
  }
  return raw;
};

const toBooleanFlag = (params: TransformFnParams): unknown => {
  const raw = params.value ?? rawValue(params);
  if (raw === true || raw === 'true' || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === '0' || raw === '' || raw == null) {
    return false;
  }
  return raw;
};

const esBorradorDto = (dto: CreateActividadDto) => Boolean(dto.esBorrador);

const toOptionalNumber = (params: TransformFnParams): unknown => {
  const raw = params.value ?? rawValue(params);
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return raw;
};

const toIdArray = (params: TransformFnParams): unknown => {
  const raw = params.value ?? rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  const ids = values
    .map((value) => Number.parseInt(String(value).trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
  return ids.length > 0 ? ids : undefined;
};

export class CreateActividadDto {
  @ApiProperty({
    example: 1,
    description: 'ID del tipo de actividad del catálogo',
  })
  @Transform(toInt)
  @IsInt({ message: 'El tipo de actividad debe ser un número entero' })
  @Min(1, { message: 'El tipo de actividad es obligatorio' })
  tipoActividadId: number;

  @ApiProperty({
    example: '2026-09-07',
    description: 'Fecha en que se realizó la actividad (YYYY-MM-DD)',
  })
  @Transform(toFechaCalendario)
  @IsDateString(
    {},
    { message: 'La fecha de la actividad debe tener formato YYYY-MM-DD' },
  )
  @IsFechaActividadValida()
  fechaActividad: string;

  @ApiProperty({
    example: '07:30',
    description: 'Hora de inicio de la actividad (HH:mm)',
  })
  @Transform(normalizeHora)
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  @Matches(HORA_PATTERN, {
    message: 'La hora de inicio debe tener formato HH:mm',
  })
  horaInicio: string;

  @ApiPropertyOptional({
    example: '2026-09-08',
    description: 'Fecha en que finaliza la actividad (YYYY-MM-DD). Opcional en borrador.',
  })
  @Transform(toFechaCalendario)
  @ValidateIf((dto: CreateActividadDto) => !esBorradorDto(dto))
  @IsNotEmpty({ message: 'La fecha de finalización es obligatoria' })
  @IsDateString(
    {},
    { message: 'La fecha de finalización debe tener formato YYYY-MM-DD' },
  )
  @IsFechaActividadValida({
    message: 'La fecha de finalización no puede ser futura',
  })
  fechaFin?: string;

  @ApiPropertyOptional({
    example: '16:00',
    description: 'Hora de finalización de la actividad (HH:mm). Opcional en borrador.',
  })
  @Transform(normalizeHora)
  @ValidateIf((dto: CreateActividadDto) => !esBorradorDto(dto))
  @IsNotEmpty({ message: 'La hora de finalización es obligatoria' })
  @Matches(HORA_PATTERN, {
    message: 'La hora de finalización debe tener formato HH:mm',
  })
  @Validate(PeriodoActividadValidoConstraint)
  horaFin?: string;

  @ApiPropertyOptional({
    description: 'Si es verdadero, se guarda como borrador y no llega a administradora',
  })
  @Transform(toBooleanFlag)
  @IsOptional()
  @IsBoolean()
  esBorrador?: boolean;

  @ApiProperty({ example: 'Reparación de tubería', maxLength: 200 })
  @Transform(trimString)
  @IsString({ message: 'El título debe ser texto' })
  @IsNotEmpty({ message: 'El título de la actividad es obligatorio' })
  @MaxLength(200, { message: 'El título no puede superar 200 caracteres' })
  titulo: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(5000, {
    message: 'La descripción no puede superar 5000 caracteres',
  })
  descripcion?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser texto' })
  @MaxLength(200, { message: 'La ubicación no puede superar 200 caracteres' })
  ubicacion?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser texto' })
  @MaxLength(5000, {
    message: 'Las observaciones no pueden superar 5000 caracteres',
  })
  observaciones?: string;

  @ApiPropertyOptional({
    description: 'Objeto de datos específicos del tipo de actividad',
  })
  @Transform(parseOptionalJsonObject)
  @IsOptional()
  @IsObject({ message: 'Los datos específicos deben ser un objeto' })
  datos?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Presión medida en PSI/bar para toma de presión',
  })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsNumber({}, { message: 'La presión medida debe ser un número' })
  presionMedida?: number;

  @ApiPropertyOptional({ description: 'Caudal medido para control operativo' })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsNumber({}, { message: 'El caudal debe ser un número' })
  caudal?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de cloro medida para control de cloros',
  })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad de cloro debe ser un número' })
  cantidadCloro?: number;

  @ApiPropertyOptional({
    description: 'Ubicación detallada de la fuga para control de fugas',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La ubicación de la fuga debe ser texto' })
  ubicacionFuga?: string;

  @ApiPropertyOptional({ description: 'Resultado de la visita de campo' })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El resultado de la visita debe ser texto' })
  resultadoVisita?: string;

  @ApiPropertyOptional({
    description: 'Documentos adjuntos para incapacidades o vacaciones',
    type: [String],
  })
  @Allow()
  @IsOptional()
  documentos?: unknown;

  @ApiPropertyOptional({
    description: 'Identificadores de evidencias a eliminar al guardar el borrador',
    type: [Number],
  })
  @Transform(toIdArray)
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  documentosEliminarIds?: number[];
}
