import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HorarioLaboralFontanero } from './entities/horario-laboral-fontanero.entity';
import { HorariosLaboralesFontaneroService } from './horarios-laborales-fontanero.service';
import { ValidacionHorarioLaboralFontaneroService } from './validacion-horario-laboral-fontanero.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosCoreModule } from './usuarios-core.module';

@Module({
  imports: [
    UsuariosCoreModule,
    TypeOrmModule.forFeature([HorarioLaboralFontanero]),
  ],
  controllers: [UsuariosController],
  providers: [
    HorariosLaboralesFontaneroService,
    ValidacionHorarioLaboralFontaneroService,
  ],
  exports: [
    UsuariosCoreModule,
    HorariosLaboralesFontaneroService,
    ValidacionHorarioLaboralFontaneroService,
    TypeOrmModule,
  ],
})
export class UsuariosModule {}
