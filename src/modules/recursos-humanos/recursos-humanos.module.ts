import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ColaboradoresController } from './colaboradores.controller';
import { ColaboradoresService } from './colaboradores.service';
import { Colaborador } from './entities/colaborador.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import { PermisosColaboradorController } from './permisos-colaborador.controller';
import { PermisosColaboradorService } from './permisos-colaborador.service';
import { VacacionesController } from './vacaciones.controller';
import { VacacionesService } from './vacaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Colaborador,
      PermisoColaborador,
      MovimientoVacaciones,
      Usuario,
    ]),
  ],
  controllers: [
    ColaboradoresController,
    PermisosColaboradorController,
    VacacionesController,
  ],
  providers: [
    ColaboradoresService,
    PermisosColaboradorService,
    VacacionesService,
  ],
  exports: [
    ColaboradoresService,
    PermisosColaboradorService,
    VacacionesService,
  ],
})
export class RecursosHumanosModule {}
