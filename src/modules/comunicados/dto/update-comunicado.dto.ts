import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

export class UpdateComunicadoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contenido?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipo?: string;

  @ApiPropertyOptional({ enum: ['Alta', 'Media', 'Baja'] })
  @IsOptional()
  @IsIn(['Alta', 'Media', 'Baja'])
  prioridad?: string;

  @ApiPropertyOptional({ enum: ['Activo', 'Inactivo'] })
  @IsOptional()
  @IsIn(['Activo', 'Inactivo'])
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  esPublico?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fechaPublicacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fechaExpiracion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imagenUrl?: string;
}
