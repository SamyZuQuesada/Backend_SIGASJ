import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { EstadoSolicitudMaterial } from '../../../common/enums/estado-solicitud-material.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const toOptionalInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

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

const toOptionalEstado = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    return raw.trim().toUpperCase();
  }
  return raw;
};

export class QuerySolicitudesMaterialDto {
  @ApiPropertyOptional({
    description: 'Número de página para paginación (comienza en 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite máximo permitido es 100 registros' })
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Filtro opcional por estado de la solicitud (PENDIENTE, APROBADA, RECHAZADA)',
    enum: EstadoSolicitudMaterial,
    example: EstadoSolicitudMaterial.PENDIENTE,
  })
  @IsOptional()
  @Transform(toOptionalEstado)
  @IsEnum(EstadoSolicitudMaterial, {
    message: `El estado debe ser uno de los permitidos: ${Object.values(
      EstadoSolicitudMaterial,
    ).join(', ')}`,
  })
  estado?: EstadoSolicitudMaterial;

  @ApiPropertyOptional({
    description: 'Filtro opcional por ID de la avería relacionada',
    example: 14,
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'El idAveria debe ser un número entero' })
  @Min(1, { message: 'El idAveria debe ser mayor a 0' })
  idAveria?: number;

  @ApiPropertyOptional({
    description: 'Alias para idAveria (filtro opcional por avería)',
    example: 14,
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'El averiaId debe ser un número entero' })
  @Min(1, { message: 'El averiaId debe ser mayor a 0' })
  averiaId?: number;

  /**
   * Validación de seguridad: impide que el frontend envíe fontaneroId o idFontanero en query params.
   */
  @ValidateIf(
    (o: Record<string, unknown>) =>
      o.fontaneroId !== undefined || o.idFontanero !== undefined,
  )
  @Transform(() => {
    throw new BadRequestException(
      'La identidad del fontanero se obtiene exclusivamente de la sesión o token JWT. No debe enviar fontaneroId ni idFontanero.',
    );
  })
  fontaneroId?: never;

  @ValidateIf(
    (o: Record<string, unknown>) =>
      o.fontaneroId !== undefined || o.idFontanero !== undefined,
  )
  @Transform(() => {
    throw new BadRequestException(
      'La identidad del fontanero se obtiene exclusivamente de la sesión o token JWT. No debe enviar fontaneroId ni idFontanero.',
    );
  })
  idFontanero?: never;
}
