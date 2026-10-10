import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ColaboradoresController } from './colaboradores.controller';
import { ColaboradoresService } from './colaboradores.service';
import { Colaborador } from './entities/colaborador.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import { PermisosColaboradorController } from './permisos-colaborador.controller';
import { PermisosColaboradorService } from './permisos-colaborador.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Colaborador, PermisoColaborador, Usuario]),
  ],
  controllers: [ColaboradoresController, PermisosColaboradorController],
  providers: [ColaboradoresService, PermisosColaboradorService],
  exports: [ColaboradoresService, PermisosColaboradorService],
})
export class RecursosHumanosModule {}
