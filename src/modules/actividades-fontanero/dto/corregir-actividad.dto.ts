import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

const toOptionalNumber = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return raw;
};

const toIdArray = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .map((value) =>
      typeof value === 'number' ? value : Number.parseInt(String(value), 10),
    )
    .filter((value) => Number.isInteger(value) && value > 0);
};

export class CorregirActividadDto {
  @ApiProperty({ example: 'Reparación de tubería (corregida)', maxLength: 200 })
  @Transform(trimString)
  @IsString({ message: 'El título debe ser texto' })
  @IsNotEmpty({ message: 'El título de la actividad es obligatorio' })
  @MaxLength(200, { message: 'El título no puede superar 200 caracteres' })
  titulo: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({
    description: 'Objeto de datos específicos del tipo de actividad',
  })
  @IsOptional()
  @IsObject({ message: 'Los datos específicos deben ser un objeto' })
  datos?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Presión medida en PSI/bar para toma de presión',
  })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber({}, { message: 'La presión medida debe ser un número' })
  presionMedida?: number;

  @ApiPropertyOptional({ description: 'Caudal medido para control operativo' })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber({}, { message: 'El caudal debe ser un número' })
  caudal?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de cloro medida para control de cloros',
  })
  @IsOptional()
  @Transform(toOptionalNumber)
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

  @ApiPropertyOptional({
    description: 'Identificadores de evidencias a eliminar al corregir',
    type: [Number],
  })
  @Transform(toIdArray)
  @IsOptional()
  @IsArray({ message: 'Las evidencias a eliminar deben ser una lista' })
  @IsInt({ each: true, message: 'Cada evidencia a eliminar debe ser un identificador' })
  documentosEliminarIds?: number[];
}
