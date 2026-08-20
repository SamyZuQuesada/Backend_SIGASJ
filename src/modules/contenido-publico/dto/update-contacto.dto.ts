import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateContactoDto {
  @IsString()
  @MaxLength(30)
  telefono: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  telefonosAdicionales?: string[];

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MaxLength(300)
  horarioAtencion: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  horarioVentanilla?: string;

  @IsString()
  @MaxLength(500)
  direccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  referenciaUbicacion?: string;

  @IsString()
  @MaxLength(200)
  regionResumen: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  mapaUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  mapaLatitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  mapaLongitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(21)
  mapaZoom?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  textoUbicacionMapa?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  urlFacebook?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcionContacto?: string;
}
