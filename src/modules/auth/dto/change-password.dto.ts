import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

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

const keepPasswordRaw = (params: TransformFnParams): unknown =>
  ensureString(rawFromPayload(params));

export class ChangePasswordDto {
  @ApiProperty({
    example: 'PasswordActual123!',
    format: 'password',
    description: 'Contraseña actual del usuario',
  })
  @Transform(keepPasswordRaw)
  @IsString({ message: 'La contraseña actual debe ser un texto válido' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @Matches(/\S/, { message: 'La contraseña actual es obligatoria' })
  currentPassword: string;

  @ApiProperty({
    example: 'PasswordNueva123!',
    format: 'password',
    description: 'Nueva contraseña (mínimo 6 caracteres)',
  })
  @Transform(keepPasswordRaw)
  @IsString({ message: 'La nueva contraseña debe ser un texto válido' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(6, {
    message: 'La nueva contraseña debe tener al menos 6 caracteres',
  })
  @Matches(/\S/, { message: 'La nueva contraseña es obligatoria' })
  newPassword: string;
}
