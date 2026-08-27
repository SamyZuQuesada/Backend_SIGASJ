import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoProyecto } from '../../../common/enums/estado-proyecto.enum';

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

const toOptionalBoolean = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (raw === true || raw === 'true' || raw === '1') {
    return true;
  }

  if (raw === false || raw === 'false' || raw === '0') {
    return false;
  }

  return raw;
};

const toOptionalInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw === 'number') {
    return raw;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return undefined;
    }
    return Number(trimmed);
  }

  return raw;
};

export class QueryProyectosAdminDto {
  @ApiPropertyOptional({
    example: 'acueducto',
    maxLength: 200,
    description: 'Búsqueda parcial por nombre.',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({
    enum: EstadoProyecto,
    enumName: 'EstadoProyecto',
  })
  @IsOptional()
  @IsEnum(EstadoProyecto, {
    message: 'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
  })
  estado?: EstadoProyecto;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Visibilidad pública (`activo`). Independiente de `estado`.',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({ minimum: 1, example: 10 })
  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor a 0' })
  limit?: number;
}
