import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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

export class CreateTransparenciaDto {
  @ApiProperty({ example: 'Informe de calidad del agua' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionBreve?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordenVisualizacion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ enum: ['pdf', 'jpg', 'jpeg', 'png'] })
  @IsOptional()
  @IsIn(['pdf', 'jpg', 'jpeg', 'png'])
  tipoArchivo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  archivoUrl?: string;
}
