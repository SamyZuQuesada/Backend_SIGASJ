import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
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

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return value;
};

/**
 * Alta administrativa de formulario descargable.
 * El PDF se envía como multipart (`archivo`); no se aceptan rutas/storageKey del cliente.
 */
export class CreateFormularioDescargableDto {
  @ApiProperty({
    example: 'Solicitud de nueva conexión',
    maxLength: 200,
  })
  @Transform(trimString)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200, {
    message: 'El nombre no puede exceder 200 caracteres',
  })
  nombre: string;

  @ApiPropertyOptional({
    example: 'Utilice este formulario para solicitar una conexión nueva.',
    maxLength: 1000,
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1000 caracteres',
  })
  descripcion?: string;

  @ApiPropertyOptional({
    description:
      'Si se omite, el formulario queda inactivo (borrador). Default false.',
    default: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description:
      'Fecha de publicación oficial (ISO 8601). Independiente de createdAt. No se asigna sola al activar.',
    example: '2026-10-25T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'fechaPublicacion debe ser una fecha ISO 8601 válida' },
  )
  fechaPublicacion?: string;
}
