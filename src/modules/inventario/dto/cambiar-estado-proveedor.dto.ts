import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsNotEmpty } from 'class-validator';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value as unknown;
};

const transformEstado = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);

  if (typeof raw === 'string') {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'activo' || trimmed === 'true' || trimmed === '1') {
      return true;
    }
    if (trimmed === 'inactivo' || trimmed === 'false' || trimmed === '0') {
      return false;
    }
  }

  return raw;
};

export class CambiarEstadoProveedorDto {
  @ApiProperty({
    description:
      'Nuevo estado del proveedor en el catálogo (true/"Activo" para activarlo, false/"Inactivo" para desactivarlo sin eliminarlo físicamente)',
    example: false,
  })
  @Transform(transformEstado)
  @IsNotEmpty({ message: 'El estado del proveedor es obligatorio' })
  @IsBoolean({
    message:
      'El estado del proveedor debe ser un valor booleano o Activo/Inactivo',
  })
  activo: boolean;
}
