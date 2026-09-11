import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
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

export class CreateProveedorDto {
  @ApiProperty({
    example: 'Ferretería El Lagar',
    maxLength: 150,
    description: 'Nombre comercial o razón social principal del proveedor',
  })
  @Transform(trimString)
  @IsString({
    message: 'El nombre del proveedor debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El nombre o razón social del proveedor es obligatorio' })
  @MaxLength(150, {
    message: 'El nombre del proveedor no puede exceder 150 caracteres',
  })
  nombre: string;

  @ApiPropertyOptional({
    example: 'El Lagar Sociedad Anónima',
    maxLength: 200,
    description: 'Razón social jurídica completa (cuando aplique)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La razón social debe ser una cadena de texto' })
  @MaxLength(200, {
    message: 'La razón social no puede exceder 200 caracteres',
  })
  razonSocial?: string | null;

  @ApiPropertyOptional({
    example: '3-101-123456',
    maxLength: 50,
    description:
      'Identificación del proveedor (cédula jurídica, física o DIMEX cuando corresponda)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La identificación debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'La identificación no puede exceder 50 caracteres',
  })
  identificacion?: string | null;

  @ApiPropertyOptional({
    example: '2680-1122',
    maxLength: 50,
    description: 'Teléfono de contacto de la empresa o sucursal proveedora',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(50, {
    message: 'El teléfono no puede exceder 50 caracteres',
  })
  telefono?: string | null;

  @ApiPropertyOptional({
    example: 'ventas@ellagar.cr',
    maxLength: 150,
    description: 'Correo electrónico para cotizaciones y pedidos',
  })
  @Transform(trimOptionalEmail)
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(150, {
    message: 'El correo electrónico no puede exceder 150 caracteres',
  })
  correo?: string | null;

  @ApiPropertyOptional({
    example: 'Nicoya, Guanacaste, 200m este del parque central',
    maxLength: 500,
    description: 'Dirección física o domicilio del proveedor',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  @MaxLength(500, {
    message: 'La dirección no puede exceder 500 caracteres',
  })
  direccion?: string | null;

  @ApiPropertyOptional({
    example: 'Carlos Méndez (Asesor Comercial)',
    maxLength: 150,
    description: 'Persona de contacto directo o ejecutivo de ventas asignado',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'La persona de contacto debe ser una cadena de texto' })
  @MaxLength(150, {
    message: 'La persona de contacto no puede exceder 150 caracteres',
  })
  personaContacto?: string | null;
}
