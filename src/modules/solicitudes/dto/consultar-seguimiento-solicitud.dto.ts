import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimUpperCodigo = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * Request público de seguimiento (código + identificación).
 * Ambos obligatorios. No acepta solicitudId, usuarioId ni flags internos
 * (ValidationPipe forbidNonWhitelisted).
 */
export class ConsultarSeguimientoSolicitudDto {
  @ApiProperty({
    example: 'SOL-2026-00001',
    description:
      'Código de seguimiento público (trim + mayúsculas). Formato SOL-YYYY-…',
    maxLength: 50,
  })
  @Transform(trimUpperCodigo)
  @IsNotEmpty({ message: 'El código de seguimiento es obligatorio' })
  @IsString({
    message: 'El código de seguimiento debe ser una cadena de texto',
  })
  @MinLength(8, {
    message: 'El código de seguimiento no tiene un formato válido',
  })
  @MaxLength(50, {
    message: 'El código de seguimiento no puede exceder 50 caracteres',
  })
  @Matches(/^SOL-\d{4}-[A-Z0-9]+$/, {
    message: 'El código de seguimiento no tiene un formato válido',
  })
  codigo!: string;

  @ApiProperty({
    example: '1-1234-0567',
    description:
      'Identificación del solicitante (string; conserva ceros y guiones). Trim únicamente.',
    maxLength: 30,
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'La identificación es obligatoria' })
  @IsString({ message: 'La identificación debe ser una cadena de texto' })
  @MinLength(1, { message: 'La identificación es obligatoria' })
  @MaxLength(30, {
    message: 'La identificación no puede exceder 30 caracteres',
  })
  identificacion!: string;
}
