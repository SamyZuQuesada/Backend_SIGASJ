import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { EstadoAlertaReposicion } from '../../../common/enums/estado-alerta-reposicion.enum';
import { transformEstadoAlertaReposicion } from './query-alertas-reposicion.dto';

export class UpdateEstadoAlertaReposicionDto {
  @ApiProperty({
    description:
      'Nuevo estado de la alerta. Transiciones permitidas: PENDIENTE → EN_GESTION → RESUELTA. Acepta también "En gestión" y "Resuelta".',
    enum: EstadoAlertaReposicion,
    example: EstadoAlertaReposicion.EN_GESTION,
  })
  @Transform(transformEstadoAlertaReposicion)
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsEnum(EstadoAlertaReposicion, {
    message: `El estado debe ser uno de los permitidos: ${Object.values(
      EstadoAlertaReposicion,
    ).join(', ')}`,
  })
  estado: EstadoAlertaReposicion;
}
