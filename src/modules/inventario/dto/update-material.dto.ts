import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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

export class UpdateMaterialDto {
  @ApiPropertyOptional({
    example: 'Tubo PVC 1/2 pulgada reforzado',
    maxLength: 150,
    description: 'Nombre del material',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El nombre del material debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del material no puede estar vacío' })
  @MaxLength(150, {
    message: 'El nombre del material no puede exceder 150 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Nueva descripción técnica del artículo',
    maxLength: 1000,
    description: 'Descripción operativa o especificaciones',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1000 caracteres',
  })
  descripcion?: string;

  @ApiPropertyOptional({
    example: 'Metro',
    maxLength: 50,
    description: 'Unidad de medida para control y despacho',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'La unidad de medida debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La unidad de medida no puede estar vacía' })
  @MaxLength(50, {
    message: 'La unidad de medida no puede exceder 50 caracteres',
  })
  unidadMedida?: string;

  @ApiPropertyOptional({
    example: 'Bodega Principal - Estante C3',
    maxLength: 150,
    description: 'Ubicación física en bodega',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  @MaxLength(150, {
    message: 'La ubicación no puede exceder 150 caracteres',
  })
  ubicacion?: string;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Nivel mínimo en inventario antes de emitir alertas de reposición (entero >= 0)',
  })
  @IsOptional()
  @IsInt({ message: 'El stock mínimo debe ser un número entero' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  stockMinimo?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado activo o inactivo del material',
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  activo?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Identificador de la categoría asignada (número entero positivo o null para desvincular)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === '') return undefined;
    if (raw === null) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed === '') return undefined;
      if (trimmed === 'null') return null;
      const parsed = Number(trimmed);
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
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
      'Alias de idCategoria para compatibilidad con clientes frontend (opcional o null para desvincular)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === '') return undefined;
    if (raw === null) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed === '') return undefined;
      if (trimmed === 'null') return null;
      const parsed = Number(trimmed);
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsInt({
    message: 'El identificador de categoría debe ser un número entero',
  })
  @Min(1, {
    message: 'El identificador de categoría debe ser mayor a cero',
  })
  categoriaId?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Identificador del proveedor asignado (número entero positivo o null para desvincular)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === '') return undefined;
    if (raw === null) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed === '') return undefined;
      if (trimmed === 'null') return null;
      const parsed = Number(trimmed);
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsInt({
    message: 'El identificador de proveedor debe ser un número entero',
  })
  @Min(1, {
    message: 'El identificador de proveedor debe ser mayor a cero',
  })
  idProveedor?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Alias de idProveedor para compatibilidad con clientes frontend (opcional o null para desvincular)',
  })
  @Transform((params: TransformFnParams) => {
    const raw = rawValue(params);
    if (raw === undefined || raw === '') return undefined;
    if (raw === null) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed === '') return undefined;
      if (trimmed === 'null') return null;
      const parsed = Number(trimmed);
      return Number.isInteger(parsed) ? parsed : raw;
    }
    return raw;
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsInt({
    message: 'El identificador de proveedor debe ser un número entero',
  })
  @Min(1, {
    message: 'El identificador de proveedor debe ser mayor a cero',
  })
  proveedorId?: number | null;
}
