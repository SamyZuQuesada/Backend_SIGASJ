import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';
import { PASSWORD_MIN_LENGTH } from '../../auth/password.util';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateUsuarioDto {
  @ApiPropertyOptional({ example: 'Carlos Pérez', maxLength: 150 })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Password123!',
    description:
      'Nueva contraseña en texto plano. Si se omite o llega vacía, no se modifica el hash.',
  })
  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  password?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.SECRETARIA })
  @IsOptional()
  @IsEnum(Role, { message: 'El rol no es válido' })
  rol?: Role;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;
}
