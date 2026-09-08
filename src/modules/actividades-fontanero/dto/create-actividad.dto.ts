import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsFechaActividadValida } from '../../../common/validators/is-fecha-actividad-valida.validator';

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

export class CreateActividadDto {
  @ApiProperty({
    example: 1,
    description: 'ID del tipo de actividad del catálogo',
  })
  @IsInt({ message: 'El tipo de actividad debe ser un número entero' })
  @Min(1, { message: 'El tipo de actividad es obligatorio' })
  tipoActividadId: number;

  @ApiProperty({
    example: '2026-09-07',
    description: 'Fecha en que se realizó la actividad (YYYY-MM-DD)',
  })
  @Transform(trimString)
  @IsDateString(
    {},
    { message: 'La fecha de la actividad debe tener formato YYYY-MM-DD' },
  )
  @IsFechaActividadValida()
  fechaActividad: string;

  @ApiProperty({ example: 'Reparación de tubería', maxLength: 200 })
  @Transform(trimString)
  @IsString({ message: 'El título debe ser texto' })
  @IsNotEmpty({ message: 'El título de la actividad es obligatorio' })
  @MaxLength(200, { message: 'El título no puede superar 200 caracteres' })
  titulo: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(5000, {
    message: 'La descripción no puede superar 5000 caracteres',
  })
  descripcion?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La ubicación no puede superar 200 caracteres' })
  ubicacion?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
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
  @IsOptional()
  @IsNumber({}, { message: 'La presión medida debe ser un número' })
  presionMedida?: number;

  @ApiPropertyOptional({ description: 'Caudal medido para control operativo' })
  @IsOptional()
  @IsNumber({}, { message: 'El caudal debe ser un número' })
  caudal?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de cloro medida para control de cloros',
  })
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
  @IsOptional()
  @IsArray({ message: 'Los documentos deben ser una lista' })
  documentos?: string[];
}
