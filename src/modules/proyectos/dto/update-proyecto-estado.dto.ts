import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { EstadoProyecto } from '../../../common/enums/estado-proyecto.enum';

export class UpdateProyectoEstadoDto {
  @ApiProperty({ enum: EstadoProyecto, example: EstadoProyecto.EN_PROCESO })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsEnum(EstadoProyecto, {
    message: 'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
  })
  estado: EstadoProyecto;
}
