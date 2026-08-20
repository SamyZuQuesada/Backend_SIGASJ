import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ContenidoPublicoController } from './contenido-publico.controller';
import { ContenidoPublicoService } from './contenido-publico.service';
import { GaleriaFoto } from './entities/galeria-foto.entity';
import { GaleriaController } from './galeria.controller';
import { GaleriaService } from './galeria.service';

@Module({
  imports: [TypeOrmModule.forFeature([GaleriaFoto])],
  controllers: [ContenidoPublicoController, GaleriaController],
  providers: [ContenidoPublicoService, GaleriaService, RolesGuard],
  exports: [ContenidoPublicoService, GaleriaService],
})
export class ContenidoPublicoModule {}
