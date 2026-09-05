import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

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

export class SolicitarCorreccionDto {
  @ApiProperty({
    example: 'Indique el material utilizado y adjunte evidencia fotográfica.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'La observación de corrección es obligatoria' })
  @MaxLength(2000)
  observacion: string;
}
