import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
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

const toOptionalInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw.trim());
    return Number.isInteger(parsed) ? parsed : raw;
  }
  return raw;
};

/**
 * Representa un renglón o ítem individual de material solicitado.
 */
export class ItemSolicitudMaterialDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Identificador del material del catálogo de inventario',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador del material debe ser un número entero' })
  @Min(1, { message: 'El identificador del material debe ser mayor a cero' })
  idMaterial?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Alias de idMaterial para compatibilidad con clientes frontend (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador del material debe ser un número entero' })
  @Min(1, { message: 'El identificador del material debe ser mayor a cero' })
  materialId?: number;

  @ApiProperty({
    example: 5,
    minimum: 1,
    description:
      'Cantidad requerida del material (entero estrictamente mayor a 0)',
  })
  @Transform(toOptionalInt)
  @IsNotEmpty({ message: 'La cantidad solicitada es obligatoria' })
  @IsInt({ message: 'La cantidad solicitada debe ser un número entero' })
  @Min(1, { message: 'La cantidad solicitada debe ser mayor a cero' })
  cantidad: number;

  @ApiPropertyOptional({
    example: 'Para sustitución de acople fracturado',
    maxLength: 255,
    description: 'Nota u observación específica para este ítem (opcional)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La observación del ítem debe ser texto' })
  @MaxLength(255, {
    message: 'La observación del ítem no puede exceder 255 caracteres',
  })
  observacion?: string;
}

/**
 * DTO para el registro de una solicitud de materiales por parte de un Fontanero.
 *
 * Importante de seguridad:
 * La identidad del fontanero solicitante NO se acepta por DTO para evitar falsificaciones
 * desde el frontend; se extrae de forma obligatoria y segura del token JWT validado.
 */
export class RegistrarSolicitudMaterialDto {
  @ApiPropertyOptional({
    example: 14,
    description:
      'Identificador de la avería asociada a la solicitud (opcional; debe estar asignada al Fontanero autenticado)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador de la avería debe ser un número entero' })
  @Min(1, { message: 'El identificador de la avería debe ser mayor a cero' })
  idAveria?: number | null;

  @ApiPropertyOptional({
    example: 14,
    description:
      'Alias de idAveria para compatibilidad con clientes frontend (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador de la avería debe ser un número entero' })
  @Min(1, { message: 'El identificador de la avería debe ser mayor a cero' })
  averiaId?: number | null;

  @ApiPropertyOptional({
    example: 'Materiales requeridos para reparación de fuga en sector central',
    maxLength: 1000,
    description: 'Observaciones o justificación general de la solicitud',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La observación debe ser texto' })
  @MaxLength(1000, {
    message: 'La observación no puede exceder 1000 caracteres',
  })
  observacion?: string;

  @ApiProperty({
    type: [ItemSolicitudMaterialDto],
    description:
      'Lista de materiales y cantidades solicitadas (debe contener al menos un material)',
  })
  @IsArray({ message: 'Los materiales deben ser enviados como una lista' })
  @ArrayNotEmpty({ message: 'La solicitud debe incluir al menos un material' })
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitudMaterialDto)
  materiales: ItemSolicitudMaterialDto[];
}
