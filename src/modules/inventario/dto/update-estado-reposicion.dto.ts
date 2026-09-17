import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { EstadoReposicionMaterial } from '../../../common/enums/estado-reposicion-material.enum';
import { normalizarEstadoReposicionMaterial } from '../../../common/enums/estado-reposicion-material.transitions';

export class UpdateEstadoReposicionDto {
  @ApiProperty({
    description:
      'Nuevo estado de la reposición. Transiciones permitidas: PENDIENTE → EN_GESTION; ' +
      'COMPRA_REGISTRADA → PENDIENTE_RECEPCION; PENDIENTE_RECEPCION → RECIBIDA; RECIBIDA → COMPLETADA.',
    enum: EstadoReposicionMaterial,
    example: EstadoReposicionMaterial.EN_GESTION,
  })
  @Transform(({ value }) => normalizarEstadoReposicionMaterial(value) ?? value)
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsEnum(EstadoReposicionMaterial, {
    message: `El estado debe ser uno de los permitidos: ${Object.values(
      EstadoReposicionMaterial,
    ).join(', ')}`,
  })
  estado: EstadoReposicionMaterial;
}
