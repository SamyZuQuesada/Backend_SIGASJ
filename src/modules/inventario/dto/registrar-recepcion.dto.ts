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

export class ItemRecepcionMaterialDto {
  @ApiPropertyOptional({
    example: 4,
    description: 'Identificador del material recibido',
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
    description: 'Cantidad físicamente recibida del material',
  })
  @Transform(toOptionalInt)
  @IsNotEmpty({ message: 'La cantidad recibida es obligatoria' })
  @IsInt({ message: 'La cantidad recibida debe ser un número entero' })
  @Min(1, { message: 'La cantidad recibida debe ser mayor a cero' })
  cantidad: number;
}

export class RegistrarRecepcionDto {
  @ApiProperty({
    example: 12,
    description: 'Identificador de la reposición/compra pendiente de recepción',
  })
  @Transform(toOptionalInt)
  @IsNotEmpty({ message: 'El identificador de la reposición es obligatorio' })
  @IsInt({ message: 'El identificador de la reposición debe ser un número entero' })
  @Min(1, { message: 'El identificador de la reposición debe ser mayor a cero' })
  idReposicion: number;

  @ApiProperty({
    type: [ItemRecepcionMaterialDto],
    description: 'Materiales recibidos y sus cantidades',
  })
  @IsArray({ message: 'Los materiales recibidos deben ser un arreglo' })
  @ArrayNotEmpty({ message: 'Debe indicar al menos un material recibido' })
  @ValidateNested({ each: true })
  @Type(() => ItemRecepcionMaterialDto)
  detalles: ItemRecepcionMaterialDto[];

  @ApiPropertyOptional({
    example: 'Recepción conforme a factura FAC-2026-0045',
    maxLength: 2000,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}
