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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { QueryProyectosAdminDto } from './dto/query-proyectos-admin.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { ProyectosService } from './proyectos.service';

@ApiTags('Proyectos')
@Controller()
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get('admin/proyectos')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Listar proyectos administrativos (Administradora)',
  })
  findAllAdmin(@Query() query: QueryProyectosAdminDto) {
    return this.proyectosService.findAllAdmin(query);
  }

  @Get('admin/proyectos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Obtener detalle de un proyecto (Administradora)',
  })
  findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.findOneAdmin(id);
  }

  @Post('admin/proyectos')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Registrar un proyecto (Administradora)',
  })
  create(
    @Body() dto: CreateProyectoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proyectosService.create(dto, user);
  }

  @Patch('admin/proyectos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Actualizar información general de un proyecto (Administradora)',
  })
  updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProyectoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proyectosService.updateAdmin(id, dto, user);
  }
}
