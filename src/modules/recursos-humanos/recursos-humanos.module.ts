import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ColaboradoresController } from './colaboradores.controller';
import { ColaboradoresService } from './colaboradores.service';
import { Colaborador } from './entities/colaborador.entity';
import { Incapacidad } from './entities/incapacidad.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import { Puesto } from './entities/puesto.entity';
import { HistorialColaboradorService } from './historial-colaborador.service';
import { IncapacidadesController } from './incapacidades.controller';
import { IncapacidadesService } from './incapacidades.service';
import { PermisosColaboradorController } from './permisos-colaborador.controller';
import { PermisosColaboradorService } from './permisos-colaborador.service';
import { PuestosController } from './puestos.controller';
import { PuestosService } from './puestos.service';
import { VacacionesController } from './vacaciones.controller';
import { VacacionesService } from './vacaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Colaborador,
      PermisoColaborador,
      MovimientoVacaciones,
      Incapacidad,
      Puesto,
      Usuario,
    ]),
  ],
  controllers: [
    ColaboradoresController,
    PermisosColaboradorController,
    VacacionesController,
    IncapacidadesController,
    PuestosController,
  ],
  providers: [
    ColaboradoresService,
    HistorialColaboradorService,
    PermisosColaboradorService,
    VacacionesService,
    IncapacidadesService,
    PuestosService,
  ],
  exports: [
    ColaboradoresService,
    HistorialColaboradorService,
    PermisosColaboradorService,
    VacacionesService,
    IncapacidadesService,
    PuestosService,
  ],
})
export class RecursosHumanosModule {}
