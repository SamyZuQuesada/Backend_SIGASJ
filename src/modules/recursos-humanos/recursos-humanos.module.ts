import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ColaboradoresController } from './colaboradores.controller';
import { ColaboradoresService } from './colaboradores.service';
import { Colaborador } from './entities/colaborador.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Colaborador, Usuario])],
  controllers: [ColaboradoresController],
  providers: [ColaboradoresService],
  exports: [ColaboradoresService],
})
export class RecursosHumanosModule {}
