import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsDefined } from 'class-validator';

// La conversión implícita global convertiría "false" en true; se valida el valor crudo.
const valorCrudo = ({ value, obj, key }: TransformFnParams): unknown =>
  obj && typeof obj === 'object' && key in obj
    ? (obj as Record<string, unknown>)[key]
    : value;

export class UpdateEstadoColaboradorDto {
  @ApiProperty({
    example: false,
    description: 'true para activar, false para inactivar',
  })
  @Transform(valorCrudo)
  @IsDefined({ message: 'El estado activo es obligatorio' })
  @IsBoolean({ message: 'El estado activo debe ser true o false' })
  activo: boolean;
}
