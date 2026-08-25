import { ApiProperty } from '@nestjs/swagger';

export class CreateAbonadoResponseDto {
  @ApiProperty({ example: 12 })
  idAbonado: number;

  @ApiProperty({ example: 'Abonado y servicio registrados correctamente.' })
  mensaje: string;
}
