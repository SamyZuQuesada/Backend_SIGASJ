import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateProyectoVisibilidadDto {
  @ApiProperty({
    description:
      'Visibilidad pública del proyecto (true para Activo, false para Inactivo)',
    example: true,
  })
  @IsNotEmpty({ message: 'El campo activo es obligatorio' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'El campo activo debe ser un valor booleano' })
  activo: boolean;
}
