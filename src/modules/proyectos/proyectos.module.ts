import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Proyecto } from './entities/proyecto.entity';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Proyecto, ImagenProyecto])],
  controllers: [ProyectosController],
  providers: [ProyectosService, RolesGuard],
  exports: [TypeOrmModule, ProyectosService],
})
export class ProyectosModule {}
