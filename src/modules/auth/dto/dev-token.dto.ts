import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

const DEV_TOKEN_ROLES = [
  'Administradora',
  'Secretaria',
  'Fontanero',
  'ADMINISTRADORA',
  'SECRETARIA',
  'FONTANERO',
] as const;

export class DevTokenDto {
  @ApiProperty({
    example: 'Administradora',
    description: 'Rol interno para emitir un JWT de desarrollo',
    enum: DEV_TOKEN_ROLES,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([...DEV_TOKEN_ROLES])
  rol: string;
}

export const DEV_TOKEN_ROLE_VALUES = DEV_TOKEN_ROLES;
