import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
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

import {
  CEDULA_DIMEX,
  CEDULA_NACIONAL,
  normalizarCedula,
} from '../../../common/utils/cedula.util';
export { CEDULA_DIMEX, CEDULA_NACIONAL, normalizarCedula };

const normalizarCedulaTransform = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? normalizarCedula(raw) : raw;
};

export class CreateColaboradorDto {
  @ApiProperty({
    example: 'Carlos',
    description: 'Nombre de pila del colaborador',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @ApiProperty({
    example: 'Pérez Mora',
    description: 'Apellidos del colaborador',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsString({ message: 'Los apellidos deben ser una cadena de texto' })
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(100, { message: 'Los apellidos no pueden exceder 100 caracteres' })
  apellidos: string;

  @ApiProperty({
    example: '1-1234-0567',
    description:
      'Cédula nacional (9 dígitos, con o sin guiones) o DIMEX (11 o 12 dígitos)',
  })
  @Transform(normalizarCedulaTransform)
  @IsString({ message: 'La cédula debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La cédula es obligatoria' })
  @Matches(new RegExp(`${CEDULA_NACIONAL.source}|${CEDULA_DIMEX.source}`), {
    message:
      'La cédula no tiene un formato válido (ej.: 1-1234-0567, 112340567 o DIMEX de 11 a 12 dígitos)',
  })
  cedula: string;

  @ApiProperty({
    example: 'carlos.perez@asadasanjuan.cr',
    description: 'Correo electrónico de contacto del colaborador',
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
    example: 'Fontanero',
    description:
      'Texto de cargo (compatibilidad). Si se envía puestoId, se sincroniza desde el puesto.',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El cargo debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El cargo no puede exceder 100 caracteres' })
  cargo?: string;

  @ApiProperty({
    example: 1,
    description: 'Puesto del catálogo formal (obligatorio en altas nuevas)',
  })
  @IsInt({ message: 'El puesto debe ser un identificador numérico entero' })
  @Min(1, { message: 'El puesto debe ser un identificador válido' })
  puestoId: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Cuenta de usuario de SIGASJ a relacionar. Omitir si el colaborador no tiene acceso al sistema',
  })
  @IsOptional()
  @IsInt({ message: 'El usuario debe ser un identificador numérico entero' })
  @Min(1, { message: 'El usuario debe ser un identificador válido' })
  usuarioId?: number;
}
