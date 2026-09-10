import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class UpdateCategoriaDto {
  @ApiPropertyOptional({
    example: 'Tuberías y Mangueras',
    maxLength: 100,
    description: 'Nombre actualizado de la categoría',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({
    message: 'El nombre de la categoría debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El nombre de la categoría no puede estar vacío' })
  @MaxLength(100, {
    message: 'El nombre de la categoría no puede exceder 100 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Líneas principales y secundarias de conducción de agua potable',
    maxLength: 500,
    description: 'Descripción actualizada de la categoría',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(500, {
    message: 'La descripción no puede exceder 500 caracteres',
  })
  descripcion?: string | null;
}
