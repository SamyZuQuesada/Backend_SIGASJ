import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoProyecto } from '../../../common/enums/estado-proyecto.enum';

export class CreateProyectoDto {
  @ApiProperty({ example: 'Ampliación de Acueducto' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del proyecto es obligatorio' })
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  encargadoRealizacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  duracion?: string;

  @ApiPropertyOptional({ enum: EstadoProyecto, default: EstadoProyecto.PENDIENTE })
  @IsOptional()
  @IsEnum(EstadoProyecto, {
    message: 'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
  })
  estado?: EstadoProyecto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagenPrincipal?: string;
}
