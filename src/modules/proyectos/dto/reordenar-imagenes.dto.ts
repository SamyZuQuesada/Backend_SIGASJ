import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReordenarImagenItemDto {
  @ApiProperty({ description: 'ID de la fotografía' })
  @Type(() => Number)
  @IsInt()
  id: number;

  @ApiProperty({ description: 'Nuevo valor de orden', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden: number;
}

export class ReordenarImagenesDto {
  @ApiProperty({
    type: [ReordenarImagenItemDto],
    description: 'Lista de imágenes con sus respectivos órdenes',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos una imagen a reordenar' })
  @ValidateNested({ each: true })
  @Type(() => ReordenarImagenItemDto)
  items: ReordenarImagenItemDto[];
}
