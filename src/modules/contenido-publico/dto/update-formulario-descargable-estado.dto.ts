import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return value;
};

/**
 * Activar / inactivar sin borrar el registro ni el PDF.
 * Inactivar ≠ eliminar.
 */
export class UpdateFormularioDescargableEstadoDto {
  @ApiProperty({
    description:
      'true = disponible públicamente; false = retirado del catálogo público (el registro y el PDF se conservan)',
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'activo debe ser un booleano' })
  activo: boolean;
}
