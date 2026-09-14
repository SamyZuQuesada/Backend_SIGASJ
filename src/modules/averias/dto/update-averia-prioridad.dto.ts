import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';
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

export class UpdateAveriaPrioridadDto {
  @ApiProperty({
    enum: PrioridadAveria,
    enumName: 'PrioridadAveria',
    example: PrioridadAveria.ALTA,
    description: 'Prioridad administrativa persistida en `prioridad`.',
  })
  @Transform(toPrioridad)
  @IsNotEmpty({ message: 'La prioridad es obligatoria' })
  @IsEnum(PrioridadAveria, {
    message: `La prioridad debe ser una de las permitidas: ${Object.values(PrioridadAveria).join(', ')}`,
  })
  prioridad: PrioridadAveria;
}
