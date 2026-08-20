import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ConsultarReciboDto {
  @ApiProperty({
    description: 'Número de paja o medidor del abonado',
    example: 130,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'El número de paja debe ser un número entero válido' })
  @Min(1, { message: 'El número de paja debe ser un número mayor a 0' })
  numeroPaja!: number;
}
