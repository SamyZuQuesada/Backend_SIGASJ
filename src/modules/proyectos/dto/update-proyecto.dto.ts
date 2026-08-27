import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class UpdateProyectoDto {
  @ApiPropertyOptional({ example: 'Ampliación de Acueducto', maxLength: 200 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del proyecto es obligatorio' })
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  encargadoRealizacion?: string;

  @ApiPropertyOptional({
    example: '8 meses',
    maxLength: 100,
    description: 'Duración en texto libre, según el modelo (varchar 100).',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  duracion?: string;
}
