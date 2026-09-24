import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { ValidacionHorarioLaboralFontaneroService } from '../usuarios/validacion-horario-laboral-fontanero.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AveriasAdminController } from './averias-admin.controller';
import { AveriasController } from './averias.controller';
import { AveriasFontaneroController } from './averias-fontanero.controller';
import { AveriasService } from './averias.service';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Averia,
      ObservacionAveria,
      Usuario,
      Rol,
      HorarioLaboralFontanero,
    ]),
    NotificacionesModule,
  ],
  controllers: [
    AveriasController,
    AveriasAdminController,
    AveriasFontaneroController,
  ],
  providers: [AveriasService, ValidacionHorarioLaboralFontaneroService],
  exports: [TypeOrmModule, AveriasService],
})
export class AveriasModule {}
