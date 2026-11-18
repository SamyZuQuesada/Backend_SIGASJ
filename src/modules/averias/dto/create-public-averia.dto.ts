import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
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

const trimOptionalEmail = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (typeof raw !== 'string') {
    return raw;
  }

  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed.toLowerCase();
};

const optionalCoord = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  return raw;
};

/**
 * Contrato público de registro de averías.
 * Solo incluye datos que el Reportante puede enviar.
 */
export class CreatePublicAveriaDto {
  @ApiProperty({
    example: 'María Rodríguez',
    maxLength: 150,
    description: 'Nombre completo de quien reporta la avería',
  })
  @Transform(trimString)
  @IsString({
    message: 'El nombre del reportante debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El nombre del reportante es obligatorio' })
  @MaxLength(150, {
    message: 'El nombre del reportante no puede exceder 150 caracteres',
  })
  nombreReportante: string;

  @ApiProperty({
    example: '1-2345-6789',
    maxLength: 50,
    description:
      'Identificación o cédula del reportante. Obligatoria para el registro público.',
  })
  @Transform(trimString)
  @IsString({ message: 'La identificación debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La identificación o cédula es obligatoria' })
  @MaxLength(50, {
    message: 'La identificación no puede exceder 50 caracteres',
  })
  identificacionReportante!: string;

  @ApiProperty({
    example: '8888-8888',
    maxLength: 50,
    description: 'Teléfono de contacto obligatorio',
  })
  @Transform(trimString)
  @IsString({
    message: 'El teléfono del reportante debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El teléfono del reportante es obligatorio' })
  @MaxLength(50, {
    message: 'El teléfono del reportante no puede exceder 50 caracteres',
  })
  telefonoReportante: string;

  @ApiPropertyOptional({
    example: 'maria@example.com',
    maxLength: 150,
    description: 'Correo electrónico opcional. Si se envía, debe ser válido.',
  })
  @Transform(trimOptionalEmail)
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(150, {
    message: 'El correo electrónico no puede exceder 150 caracteres',
  })
  correoReportante?: string | null;

  @ApiProperty({
    example: 'Frente a la escuela, 50 m sur, casa verde',
    maxLength: 500,
    description: 'Dirección o ubicación exacta de la avería',
  })
  @Transform(trimString)
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La ubicación exacta es obligatoria' })
  @MaxLength(500, {
    message: 'La ubicación no puede exceder 500 caracteres',
  })
  ubicacion: string;

  @ApiPropertyOptional({
    example: 10.2188017,
    description:
      'Latitud WGS84 opcional del punto reportado. Si se envía, también debe enviarse longitud.',
  })
  @Transform(optionalCoord)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsNumber({}, { message: 'La latitud debe ser un número válido' })
  @Min(-90, { message: 'La latitud debe estar entre -90 y 90' })
  @Max(90, { message: 'La latitud debe estar entre -90 y 90' })
  latitud?: number | null;

  @ApiPropertyOptional({
    example: -85.5565018,
    description:
      'Longitud WGS84 opcional del punto reportado. Si se envía, también debe enviarse latitud.',
  })
  @Transform(optionalCoord)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsNumber({}, { message: 'La longitud debe ser un número válido' })
  @Min(-180, { message: 'La longitud debe estar entre -180 y 180' })
  @Max(180, { message: 'La longitud debe estar entre -180 y 180' })
  longitud?: number | null;

  @ApiProperty({
    example: 'San Juan',
    maxLength: 150,
    description: 'Sector o comunidad donde ocurre la avería',
  })
  @Transform(trimString)
  @IsString({
    message: 'El sector o comunidad debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El sector o comunidad es obligatorio' })
  @MaxLength(150, {
    message: 'El sector o comunidad no puede exceder 150 caracteres',
  })
  sectorComunidad: string;

  @ApiProperty({
    example: 'Se observa una fuga visible en la tubería de distribución',
    maxLength: 4000,
    description: 'Descripción del problema reportado',
  })
  @Transform(trimString)
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La descripción de la avería es obligatoria' })
  @MaxLength(4000, {
    message: 'La descripción no puede exceder 4000 caracteres',
  })
  descripcion: string;
}
