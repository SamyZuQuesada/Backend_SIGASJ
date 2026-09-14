import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { EstadoAveria } from '../../../common/enums/estado-averia.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const toEstado = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (typeof raw === 'string') {
    return raw.trim().toUpperCase();
  }
  return raw;
};

export class UpdateAveriaEstadoDto {
  @ApiProperty({
    enum: EstadoAveria,
    enumName: 'EstadoAveria',
    example: EstadoAveria.EN_REVISION,
    description:
      'Nuevo estado administrativo. Debe respetar las transiciones definidas en Backend.',
  })
  @Transform(toEstado)
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsEnum(EstadoAveria, {
    message: `El estado debe ser uno de los permitidos: ${Object.values(EstadoAveria).join(', ')}`,
  })
  estado: EstadoAveria;
}
