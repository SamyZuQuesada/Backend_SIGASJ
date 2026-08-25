import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateServicioAbonadoDto {
  @ApiProperty({ example: 'NIS-2026-001' })
  @IsString()
  @IsNotEmpty({ message: 'El NIS es obligatorio' })
  @MaxLength(30)
  nis: string;

  @ApiProperty({ example: 'MED-45821' })
  @IsString()
  @IsNotEmpty({ message: 'El número de medidor es obligatorio' })
  @MaxLength(30)
  medidor: string;

  @ApiProperty({ example: 'Sector Centro' })
  @IsString()
  @IsNotEmpty({ message: 'El sector es obligatorio' })
  @MaxLength(100)
  sector: string;

  @ApiProperty({ example: 'Residencial' })
  @IsString()
  @IsNotEmpty({ message: 'La tarifa es obligatoria' })
  @MaxLength(50)
  tarifa: string;

  @ApiProperty({ example: 'PL-1024' })
  @IsString()
  @IsNotEmpty({ message: 'El número de plano es obligatorio' })
  @MaxLength(50)
  numeroPlano: string;
}

export class CreateAbonadoDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idSolicitud?: number;

  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Rodríguez Mora' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(100)
  apellidos: string;

  @ApiProperty({ example: '1-2345-6789' })
  @IsString()
  @IsNotEmpty({ message: 'La cédula es obligatoria' })
  @MaxLength(20)
  cedula: string;

  @ApiProperty({ example: '8888-1234' })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @MaxLength(20)
  telefono: string;

  @ApiProperty({ example: 'maria.rodriguez@correo.cr' })
  @IsString()
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @MaxLength(120)
  correo: string;

  @ApiProperty({ example: 'San Juan, Desamparados' })
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @MaxLength(300)
  direccion: string;

  @ApiProperty({ type: CreateServicioAbonadoDto })
  @ValidateNested()
  @Type(() => CreateServicioAbonadoDto)
  servicio: CreateServicioAbonadoDto;
}
