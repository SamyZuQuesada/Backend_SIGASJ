import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateComunicadoEstadoDto {
  @ApiProperty({ enum: ['Activo', 'Inactivo'] })
  @IsIn(['Activo', 'Inactivo'], {
    message: 'El estado debe ser Activo o Inactivo',
  })
  estado: 'Activo' | 'Inactivo';
}
