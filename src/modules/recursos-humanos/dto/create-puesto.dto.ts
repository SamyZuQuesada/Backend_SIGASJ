import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePuestoDto {
  @ApiProperty({ example: 'Fontanero', maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del puesto es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Marca de criticidad operativa (cobertura solo si hay config)',
  })
  @IsOptional()
  @IsBoolean()
  critico?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
