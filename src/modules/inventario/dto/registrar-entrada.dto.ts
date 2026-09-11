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

export class RegistrarEntradaDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del material que ingresa físicamente a bodega',
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
    example: 15,
    minimum: 1,
    description:
      'Cantidad física de unidades que ingresan a bodega (estrictamente mayor a 0)',
  })
  @Transform(toOptionalInt)
  @IsNotEmpty({ message: 'La cantidad de entrada es obligatoria' })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad de entrada debe ser mayor a cero' })
  cantidad: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Identificador del proveedor que suministró el material (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador de proveedor debe ser un número entero' })
  @Min(1, { message: 'El identificador de proveedor debe ser mayor a cero' })
  idProveedor?: number | null;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Alias de idProveedor para compatibilidad con clientes frontend (opcional)',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador de proveedor debe ser un número entero' })
  @Min(1, { message: 'El identificador de proveedor debe ser mayor a cero' })
  proveedorId?: number | null;

  @ApiPropertyOptional({
    example: 'Ingreso por compra según factura F-4589',
    maxLength: 1000,
    description:
      'Motivo, justificación u observaciones de la entrada de inventario',
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
      'Fecha y hora en la que se realizó físicamente el ingreso (opcional; si se omite, se asigna la fecha actual)',
  })
  @Transform(toOptionalDate)
  @IsOptional()
  @IsDate({ message: 'La fecha de movimiento debe ser una fecha válida' })
  fechaMovimiento?: Date;
}
