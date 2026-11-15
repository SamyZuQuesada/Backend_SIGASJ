import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';
import { PASSWORD_MIN_LENGTH } from '../../auth/password.util';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndLower = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUsuarioDto {
  @ApiProperty({ example: 'Carlos Pérez', maxLength: 150 })
  @Transform(trimString)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre: string;

  @ApiProperty({ example: 'carlos@asadasanjuan.cr' })
  @Transform(trimAndLower)
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @MaxLength(150, { message: 'El correo no puede exceder 150 caracteres' })
  correo: string;

  @ApiProperty({ example: 'Password123!', minLength: PASSWORD_MIN_LENGTH })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  password: string;

  @ApiProperty({ enum: Role, example: Role.FONTANERO })
  @IsEnum(Role, { message: 'El rol no es válido' })
  rol: Role;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;
}
