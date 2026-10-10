import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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
  return trimmed === '' ? null : trimmed;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePermisoColaboradorDto {
  @ApiProperty({
    example: 3,
    description: 'Identificador del colaborador al que se registra el permiso',
  })
  @IsInt({ message: 'El colaborador debe ser un identificador numérico entero' })
  @Min(1, { message: 'El colaborador debe ser un identificador válido' })
  colaboradorId: number;

  @ApiProperty({
    example: '2026-10-12',
    description: 'Primer día del permiso (YYYY-MM-DD)',
  })
  @Transform(trimString)
  @IsString({ message: 'La fecha de inicio debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'La fecha de inicio debe tener formato YYYY-MM-DD',
  })
  fechaInicio: string;

  @ApiProperty({
    example: '2026-10-14',
    description: 'Último día del permiso (YYYY-MM-DD)',
  })
  @Transform(trimString)
  @IsString({ message: 'La fecha de fin debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'La fecha de fin debe tener formato YYYY-MM-DD',
  })
  fechaFin: string;

  @ApiProperty({
    example: 'Cita médica',
    maxLength: 200,
    description: 'Motivo del permiso',
  })
  @Transform(trimString)
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(200, { message: 'El motivo no puede exceder 200 caracteres' })
  motivo: string;

  @ApiPropertyOptional({
    example: 'Requiere cobertura del ayudante',
    maxLength: 500,
    nullable: true,
    description: 'Observaciones opcionales del registro',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  @MaxLength(500, {
    message: 'Las observaciones no pueden exceder 500 caracteres',
  })
  observaciones?: string | null;
}
