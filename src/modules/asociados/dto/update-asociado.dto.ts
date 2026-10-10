import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CreateAsociadoDto } from './create-asociado.dto';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const trimAndLowerString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
};

export class UpdateAsociadoDto extends PartialType(
  OmitType(CreateAsociadoDto, ['fechaRegistro'] as const),
) {
  @ApiPropertyOptional({
    example: 'juan.perez@example.com',
    description:
      'Correo electrónico de contacto del asociado (alias de correoElectronico)',
    maxLength: 150,
  })
  @Transform(trimAndLowerString)
  @IsOptional()
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El correo electrónico no puede estar vacío' })
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @MaxLength(150, {
    message: 'El correo electrónico no puede exceder 150 caracteres',
  })
  correo?: string;
}
