import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConsultaCedulaQueryDto {
  @ApiProperty({
    example: '1-2345-6789',
    description:
      'Cédula o identificación. Se aceptan guiones; la consulta usa solo los dígitos.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Indique la cédula o identificación.' })
  @MaxLength(50)
  identificacion: string;
}
