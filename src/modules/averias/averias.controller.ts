import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AveriasService } from './averias.service';
import { CreatePublicAveriaDto } from './dto/create-public-averia.dto';
import { RegistroPublicoAveriaResponseDto } from './dto/registro-publico-averia-response.dto';

@ApiTags('Averías (Registro Público)')
@Controller('public/averias')
export class AveriasController {
  constructor(private readonly averiasService: AveriasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una avería sin iniciar sesión (Público)',
    description:
      'Permite a cualquier persona de la comunidad reportar una avería. No requiere JWT, Usuario ni Abonado. El código de seguimiento, la fecha y el estado Recibida los genera el sistema.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Avería registrada correctamente',
    type: RegistroPublicoAveriaResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos incompletos, inválidos o campos no permitidos',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'No se pudo registrar la avería',
  })
  createPublic(
    @Body() dto: CreatePublicAveriaDto,
  ): Promise<RegistroPublicoAveriaResponseDto> {
    return this.averiasService.createPublicReport(dto);
  }
}
