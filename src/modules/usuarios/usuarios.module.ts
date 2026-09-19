import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HorarioLaboralFontanero } from './entities/horario-laboral-fontanero.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { HorariosLaboralesFontaneroService } from './horarios-laborales-fontanero.service';
import { ValidacionHorarioLaboralFontaneroService } from './validacion-horario-laboral-fontanero.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol, HorarioLaboralFontanero])],
  controllers: [UsuariosController],
  providers: [
    UsuariosService,
    HorariosLaboralesFontaneroService,
    ValidacionHorarioLaboralFontaneroService,
  ],
  exports: [
    UsuariosService,
    HorariosLaboralesFontaneroService,
    ValidacionHorarioLaboralFontaneroService,
    TypeOrmModule,
  ],
})
export class UsuariosModule {}
