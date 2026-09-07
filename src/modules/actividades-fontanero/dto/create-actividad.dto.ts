import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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

export class CreateActividadDto {
  @ApiProperty({ example: 1, description: 'ID del tipo de actividad del catálogo' })
  @IsInt({ message: 'El tipo de actividad debe ser un número entero' })
  @Min(1, { message: 'El tipo de actividad es obligatorio' })
  tipoActividadId: number;

  @ApiProperty({ example: '2026-09-07', description: 'Fecha en que se realizó la actividad (YYYY-MM-DD)' })
  @Transform(trimString)
  @IsDateString({}, { message: 'La fecha de la actividad debe tener formato YYYY-MM-DD' })
  fechaActividad: string;

  @ApiProperty({ example: 'Reparación de tubería', maxLength: 200 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'El título de la actividad es obligatorio' })
  @MaxLength(200)
  titulo: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  observaciones?: string;
}
