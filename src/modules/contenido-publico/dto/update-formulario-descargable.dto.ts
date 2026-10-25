import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
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

const trimDescripcion = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Edición de metadata únicamente.
 * No incluye activo (usar PATCH .../estado) ni archivo (usar PATCH .../archivo).
 */
export class UpdateFormularioDescargableDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(200, {
    message: 'El nombre no puede exceder 200 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({
    maxLength: 1000,
    nullable: true,
    description: 'Enviar null o "" para limpiar la descripción',
  })
  @IsOptional()
  @Transform(trimDescripcion)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1000 caracteres',
  })
  descripcion?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'ISO 8601 o null para quitar la fecha de publicación',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString(
    {},
    { message: 'fechaPublicacion debe ser una fecha ISO 8601 válida' },
  )
  fechaPublicacion?: string | null;
}
