import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const toOptionalInt = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw : Number.NaN;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    if (!/^-?\d+$/.test(trimmed)) {
      return Number.NaN;
    }
    return parseInt(trimmed, 10);
  }
  return raw;
};

export class CreateReposicionDesdeAlertaDto {
  @ApiPropertyOptional({
    description:
      'Cantidad a reponer. Si se omite, se calcula como el faltante respecto al stock mínimo (mínimo 1).',
    example: 30,
    minimum: 1,
  })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor a cero' })
  cantidad?: number;

  @ApiPropertyOptional({
    description: 'Observación administrativa opcional',
    example: 'Reposición originada por alerta de stock mínimo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}
