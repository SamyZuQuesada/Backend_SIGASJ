import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const toOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
};

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }

  return value;
};

const toInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  return Number.parseInt(String(value), 10);
};

export class CreateGaleriaFotoDto {
  @ApiPropertyOptional({ example: 'Tanque de almacenamiento' })
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  @MaxLength(200)
  titulo?: string | null;

  @ApiPropertyOptional({
    example: 'Infraestructura principal del acueducto comunal.',
  })
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  descripcion?: string | null;

  @ApiProperty({ example: 'Tanque elevado de la ASADA San Juan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  textoAlternativo: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  ordenVisualizacion?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;
}

export class UpdateGaleriaFotoDto {
  @ApiPropertyOptional({ example: 'Tanque de almacenamiento' })
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  @MaxLength(200)
  titulo?: string | null;

  @ApiPropertyOptional({
    example: 'Infraestructura principal del acueducto comunal.',
  })
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  descripcion?: string | null;

  @ApiPropertyOptional({ example: 'Tanque elevado de la ASADA San Juan' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  textoAlternativo?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  ordenVisualizacion?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;
}

export class UpdateGaleriaFotoActivoDto {
  @ApiProperty({ example: true })
  @Transform(toBoolean)
  @IsBoolean()
  activo: boolean;
}

export class ListGaleriaFotoQueryDto {
  @ApiPropertyOptional({ example: 'tanque' })
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;
}
