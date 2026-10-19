import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePuestoDto } from './dto/create-puesto.dto';
import { UpdatePuestoDto } from './dto/update-puesto.dto';
import { Puesto } from './entities/puesto.entity';
import { PuestosService } from './puestos.service';
import { RRHH_ADMIN_ROLES } from './rrhh-roles';

@ApiTags('Recursos Humanos - Puestos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...RRHH_ADMIN_ROLES)
@Controller('rrhh/puestos')
export class PuestosController {
  constructor(private readonly puestosService: PuestosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear puesto del catálogo' })
  create(@Body() dto: CreatePuestoDto): Promise<Puesto> {
    return this.puestosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar puestos' })
  findAll(@Query('soloActivos') soloActivos?: string): Promise<Puesto[]> {
    return this.puestosService.findAll(soloActivos === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de puesto' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Puesto> {
    return this.puestosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar puesto' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePuestoDto,
  ): Promise<Puesto> {
    return this.puestosService.update(id, dto);
  }
}
