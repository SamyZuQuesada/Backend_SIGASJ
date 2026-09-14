import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const toFontaneroId = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null || raw === '') {
    return raw;
  }
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw : Number.NaN;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      return Number.NaN;
    }
    return parseInt(trimmed, 10);
  }
  return raw;
};

/**
 * Asignación inicial de Fontanero (PBI 2.4).
 * `fontaneroId` es `Usuario.idUsuario` (int identity), no UUID.
 */
export class AssignAveriaFontaneroDto {
  @ApiProperty({
    example: 7,
    minimum: 1,
    description:
      'PK numérica de Usuario (`idUsuario`) que se asignará como Fontanero.',
  })
  @Transform(toFontaneroId)
  @IsNotEmpty({ message: 'El identificador del fontanero es obligatorio' })
  @IsInt({ message: 'fontaneroId debe ser un número entero' })
  @Min(1, { message: 'fontaneroId debe ser un entero positivo' })
  fontaneroId: number;
}
