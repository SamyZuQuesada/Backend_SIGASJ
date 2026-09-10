import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
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

export class CreateMaterialDto {
  @ApiProperty({
    example: 'Tubo PVC 1/2 pulgada',
    maxLength: 150,
    description: 'Nombre descriptivo del material en bodega',
  })
  @Transform(trimString)
  @IsString({ message: 'El nombre del material debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del material es obligatorio' })
  @MaxLength(150, {
    message: 'El nombre del material no puede exceder 150 caracteres',
  })
  nombre: string;

  @ApiPropertyOptional({
    example: 'Tubo de presión SDR 13.5 para conducción de agua potable',
    maxLength: 1000,
    description: 'Descripción técnica u operativa del material',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1000 caracteres',
  })
  descripcion?: string;

  @ApiProperty({
    example: 'Tubo',
    maxLength: 50,
    description: 'Unidad de medida para control y despacho',
  })
  @Transform(trimString)
  @IsString({ message: 'La unidad de medida debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La unidad de medida es obligatoria' })
  @MaxLength(50, {
    message: 'La unidad de medida no puede exceder 50 caracteres',
  })
  unidadMedida: string;

  @ApiPropertyOptional({
    example: 'Bodega Principal - Estante B2',
    maxLength: 150,
    description: 'Ubicación física del artículo en bodega',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  @MaxLength(150, {
    message: 'La ubicación no puede exceder 150 caracteres',
  })
  ubicacion?: string;

  @ApiPropertyOptional({
    example: 10,
    default: 0,
    description:
      'Nivel mínimo en inventario antes de emitir alertas de reposición',
  })
  @IsOptional()
  @IsInt({ message: 'El stock mínimo debe ser un número entero' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  stockMinimo?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Identificador de la categoría para clasificar el material en bodega (opcional)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw.trim());
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @IsInt({
    message: 'El identificador de categoría debe ser un número entero',
  })
  @Min(1, {
    message: 'El identificador de categoría debe ser mayor a cero',
  })
  idCategoria?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Alias de idCategoria para compatibilidad con clientes frontend (opcional)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw.trim());
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @IsInt({
    message: 'El identificador de categoría debe ser un número entero',
  })
  @Min(1, {
    message: 'El identificador de categoría debe ser mayor a cero',
  })
  categoriaId?: number | null;
}
