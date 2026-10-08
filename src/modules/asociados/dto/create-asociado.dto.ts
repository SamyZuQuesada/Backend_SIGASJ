import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsISO8601,
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

const trimAndLowerString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
};

export class CreateAsociadoDto {
  @ApiProperty({
    example: 'Juan',
    description: 'Nombre de pila del asociado',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @ApiProperty({
    example: 'Pérez Rodríguez',
    description: 'Apellidos del asociado',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsString({ message: 'Los apellidos deben ser una cadena de texto' })
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(100, { message: 'Los apellidos no pueden exceder 100 caracteres' })
  apellidos: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Cédula de identidad única del asociado',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsString({ message: 'La cédula debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La cédula es obligatoria' })
  @MaxLength(30, { message: 'La cédula no puede exceder 30 caracteres' })
  cedula: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Correo electrónico de contacto del asociado',
    maxLength: 150,
  })
  @Transform(trimAndLowerString)
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @MaxLength(150, {
    message: 'El correo electrónico no puede exceder 150 caracteres',
  })
  correoElectronico: string;

  @ApiPropertyOptional({
    example: '2026-01-15T08:00:00.000Z',
    description:
      'Fecha en la que el asociado se afilió a la ASADA. Si no se especifica, se toma la fecha actual',
  })
  @IsOptional()
  @IsISO8601(
    {},
    { message: 'La fecha de registro debe ser una fecha ISO 8601 válida' },
  )
  fechaRegistro?: string;
}
