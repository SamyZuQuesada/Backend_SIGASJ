import { PartialType } from '@nestjs/swagger';
import { CreatePermisoColaboradorDto } from './create-permiso-colaborador.dto';

export class UpdatePermisoColaboradorDto extends PartialType(
  CreatePermisoColaboradorDto,
) {}
