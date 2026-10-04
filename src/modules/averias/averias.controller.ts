import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AveriasService } from './averias.service';
import {
  ConsultaCedulaService,
  type ConsultaCedulaResultado,
} from './consulta-cedula.service';
import { ConsultaCedulaQueryDto } from './dto/consulta-cedula-query.dto';
import { CreatePublicAveriaDto } from './dto/create-public-averia.dto';
import { RegistroPublicoAveriaResponseDto } from './dto/registro-publico-averia-response.dto';

@ApiTags('Averías (Registro Público)')
@Controller('public/averias')
export class AveriasController {
  constructor(
    private readonly averiasService: AveriasService,
    private readonly consultaCedulaService: ConsultaCedulaService,
  ) {}

  @Get('cedula')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar el nombre público de una cédula',
    description:
      'Consulta el registro público de Hacienda y devuelve el nombre inscrito. No incluye teléfono, correo ni situación tributaria.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resultado de la consulta. encontrada=false si no hay nombre público.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'La identificación no tiene entre 9 y 12 dígitos.',
  })
  consultarCedula(
    @Query() query: ConsultaCedulaQueryDto,
  ): Promise<ConsultaCedulaResultado> {
    return this.consultaCedulaService.consultar(query.identificacion);
  }

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
