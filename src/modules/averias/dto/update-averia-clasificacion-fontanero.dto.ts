import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsNotEmpty } from 'class-validator';
import {
  TIPOS_AVERIA_FONTANERO,
  TipoAveria,
} from '../../../common/enums/tipo-averia.enum';

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

export class UpdateAveriaClasificacionFontaneroDto {
  @ApiProperty({
    enum: TIPOS_AVERIA_FONTANERO,
    example: TipoAveria.TUBO_MADRE,
    description:
      'Tipo que califica el Fontanero: Tubo madre o Tubo medidor. Body: `clasificacion`.',
  })
  @Transform(toClasificacion)
  @IsNotEmpty({ message: 'La clasificación es obligatoria' })
  @IsIn(TIPOS_AVERIA_FONTANERO, {
    message: 'El tipo debe ser Tubo madre o Tubo medidor',
  })
  clasificacion: (typeof TIPOS_AVERIA_FONTANERO)[number];
}
