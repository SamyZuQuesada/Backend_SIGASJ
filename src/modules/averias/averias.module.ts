import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { AveriasAdminController } from './averias-admin.controller';
import { AveriasController } from './averias.controller';
import { AveriasService } from './averias.service';
import { Averia } from './entities/averia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Averia, Usuario, Rol])],
  controllers: [AveriasController, AveriasAdminController],
  providers: [AveriasService],
  exports: [TypeOrmModule, AveriasService],
})
export class AveriasModule {}
