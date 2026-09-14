import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { TipoAveria } from '../../../common/enums/tipo-averia.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const toClasificacion = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (typeof raw === 'string') {
    return raw.trim().toUpperCase();
  }
  return raw;
};

export class UpdateAveriaClasificacionDto {
  @ApiProperty({
    enum: TipoAveria,
    enumName: 'TipoAveria',
    example: TipoAveria.FUGA,
    description:
      'Clasificación administrativa. Se guarda en la columna existente `tipoAveria`.',
  })
  @Transform(toClasificacion)
  @IsNotEmpty({ message: 'La clasificación es obligatoria' })
  @IsEnum(TipoAveria, {
    message: `La clasificación debe ser una de las permitidas: ${Object.values(TipoAveria).join(', ')}`,
  })
  clasificacion: TipoAveria;
}
