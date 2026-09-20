import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsNotEmpty } from 'class-validator';
import { PrioridadAveria } from '../../../common/enums/prioridad-averia.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const toPrioridad = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (typeof raw === 'string') {
    return raw.trim().toUpperCase();
  }
  return raw;
};

export const PRIORIDADES_AVERIA_FONTANERO = [
  PrioridadAveria.BAJA,
  PrioridadAveria.MEDIA,
  PrioridadAveria.ALTA,
] as const;

export class UpdateAveriaPrioridadFontaneroDto {
  @ApiProperty({
    enum: PRIORIDADES_AVERIA_FONTANERO,
    example: PrioridadAveria.MEDIA,
    description: 'Prioridad que califica el Fontanero: Baja, Media o Alta.',
  })
  @Transform(toPrioridad)
  @IsNotEmpty({ message: 'La prioridad es obligatoria' })
  @IsIn(PRIORIDADES_AVERIA_FONTANERO, {
    message: 'La prioridad debe ser Baja, Media o Alta',
  })
  prioridad: (typeof PRIORIDADES_AVERIA_FONTANERO)[number];
}
