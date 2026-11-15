import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Contrato de entrada del login.
 * Identificador real: correo (`email`).
 * No incluye rol, activo ni passwordHash.
 *
 * Trim solo del correo. Password no se altera (espacios internos legítimos).
 * Lee el valor crudo del payload (`obj[key]`) porque ValidationPipe global
 * con enableImplicitConversion convierte number→string ANTES de @Transform.
 */
const rawFromPayload = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj != null && typeof key === 'string' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const ensureString = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) {
    return raw;
  }
  if (typeof raw !== 'string') {
    return { __notString: true };
  }
  return raw;
};

const trimEmail = (params: TransformFnParams): unknown => {
  const ensured = ensureString(rawFromPayload(params));
  return typeof ensured === 'string' ? ensured.trim() : ensured;
};

const keepPasswordRaw = (params: TransformFnParams): unknown =>
  ensureString(rawFromPayload(params));

export class LoginDto {
  @ApiProperty({
    example: 'usuario.test@example.com',
    description: 'Correo electrónico del usuario (identificador de login)',
  })
  @Transform(trimEmail)
  @IsString({ message: 'El correo electrónico debe ser un texto válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña de acceso',
    format: 'password',
  })
  @Transform(keepPasswordRaw)
  @IsString({ message: 'La contraseña debe ser un texto válido' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
  })
  /** Rechaza solo-espacios sin hacer trim de la password. */
  @Matches(/\S/, { message: 'La contraseña es obligatoria' })
  password: string;
}
