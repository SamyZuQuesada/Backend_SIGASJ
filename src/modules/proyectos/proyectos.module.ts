import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from './entities/proyecto.entity';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Proyecto, ImagenProyecto])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class ProyectosModule {}

