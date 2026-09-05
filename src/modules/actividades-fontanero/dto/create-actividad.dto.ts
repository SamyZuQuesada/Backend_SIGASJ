import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsNotEmpty,
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

export class CreateActividadDto {
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
}
