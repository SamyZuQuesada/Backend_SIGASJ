import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDate,
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

const toOptionalDate = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : d;
  }
  return raw;
};

export class RegistrarSalidaDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del material que sale físicamente de bodega',
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
      'Cantidad física de unidades que salen de bodega (estrictamente mayor a 0)',
  })
  @Transform(toOptionalInt)
  @IsNotEmpty({ message: 'La cantidad de salida es obligatoria' })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad de salida debe ser mayor a cero' })
  cantidad: number;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Identificador de la avería a la que se vincula el material retirado (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador de la avería debe ser un número entero' })
  @Min(1, { message: 'El identificador de la avería debe ser mayor a cero' })
  idAveria?: number | null;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Alias de idAveria para compatibilidad con clientes frontend (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador de la avería debe ser un número entero' })
  @Min(1, { message: 'El identificador de la avería debe ser mayor a cero' })
  averiaId?: number | null;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Identificador de la solicitud aprobada asociada al retiro de materiales (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({
    message: 'El identificador de la solicitud debe ser un número entero',
  })
  @Min(1, { message: 'El identificador de la solicitud debe ser mayor a cero' })
  idSolicitud?: number | null;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Alias de idSolicitud para compatibilidad con clientes frontend (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({
    message: 'El identificador de la solicitud debe ser un número entero',
  })
  @Min(1, { message: 'El identificador de la solicitud debe ser mayor a cero' })
  solicitudId?: number | null;

  @ApiPropertyOptional({
    example: 'Reparación de fuga principal en sector San Juan',
    maxLength: 1000,
    description:
      'Motivo, justificación u observaciones de la salida de inventario',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto' })
  @MaxLength(1000, {
    message: 'La observación no puede exceder 1000 caracteres',
  })
  observacion?: string;

  @ApiPropertyOptional({
    example: '2026-08-22T10:30:00Z',
    description:
      'Fecha y hora en la que se realizó físicamente la salida (opcional; si se omite, se asigna la fecha actual desde el backend)',
  })
  @Transform(toOptionalDate)
  @IsOptional()
  @IsDate({ message: 'La fecha de movimiento debe ser una fecha válida' })
  fechaMovimiento?: Date;
}
