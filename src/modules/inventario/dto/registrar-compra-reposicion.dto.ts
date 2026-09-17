import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
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
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw : Number.NaN;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    if (!/^-?\d+$/.test(trimmed)) {
      return Number.NaN;
    }
    return parseInt(trimmed, 10);
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

export class ItemCompraReposicionDto {
  @ApiPropertyOptional({
    example: 4,
    description: 'Identificador del material comprado',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador del material debe ser un número entero' })
  @Min(1, { message: 'El identificador del material debe ser mayor a cero' })
  idMaterial?: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Alias de idMaterial para compatibilidad con clientes frontend',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador del material debe ser un número entero' })
  @Min(1, { message: 'El identificador del material debe ser mayor a cero' })
  materialId?: number;

  @ApiProperty({
    example: 30,
    minimum: 1,
    description: 'Cantidad adquirida del material',
  })
  @Transform(toOptionalInt)
  @IsNotEmpty({ message: 'La cantidad comprada es obligatoria' })
  @IsInt({ message: 'La cantidad comprada debe ser un número entero' })
  @Min(1, { message: 'La cantidad comprada debe ser mayor a cero' })
  cantidad: number;

  @ApiPropertyOptional({
    example: 'Compra según cotización del proveedor',
    maxLength: 255,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;
}

export class RegistrarCompraReposicionDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'Identificador del proveedor que suministrará los materiales',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador del proveedor debe ser un número entero' })
  @Min(1, { message: 'El identificador del proveedor debe ser mayor a cero' })
  idProveedor?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Alias de idProveedor para compatibilidad con clientes frontend',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'El identificador del proveedor debe ser un número entero' })
  @Min(1, { message: 'El identificador del proveedor debe ser mayor a cero' })
  proveedorId?: number;

  @ApiProperty({
    example: '2026-08-25T00:00:00.000Z',
    description: 'Fecha en que se realizó la compra',
  })
  @Transform(toOptionalDate)
  @IsNotEmpty({ message: 'La fecha de compra es obligatoria' })
  @IsDate({ message: 'La fecha de compra debe ser una fecha válida' })
  fechaCompra: Date;

  @ApiProperty({
    type: [ItemCompraReposicionDto],
    description: 'Materiales adquiridos y sus cantidades',
  })
  @IsArray({ message: 'Los detalles de la compra deben ser un arreglo' })
  @ArrayNotEmpty({ message: 'Debe indicar al menos un material comprado' })
  @ValidateNested({ each: true })
  @Type(() => ItemCompraReposicionDto)
  detalles: ItemCompraReposicionDto[];

  @ApiPropertyOptional({
    example: 'FAC-2026-0045',
    description: 'Referencia de factura, orden de compra u otro documento',
    maxLength: 100,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenciaCompra?: string;

  @ApiPropertyOptional({
    example: 'Compra autorizada por la junta directiva',
    maxLength: 2000,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}
