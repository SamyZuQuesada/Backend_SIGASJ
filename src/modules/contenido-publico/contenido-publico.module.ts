import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ContenidoPublicoController } from './contenido-publico.controller';
import { ContenidoPublicoService } from './contenido-publico.service';
import { ContactoPublico } from './entities/contacto-publico.entity';
import { GaleriaFoto } from './entities/galeria-foto.entity';
import { GaleriaController } from './galeria.controller';
import { GaleriaService } from './galeria.service';
import { ContactoService } from './contacto.service';

@Module({
  imports: [TypeOrmModule.forFeature([GaleriaFoto, ContactoPublico])],
  controllers: [ContenidoPublicoController, GaleriaController],
  providers: [
    ContenidoPublicoService,
    ContactoService,
    GaleriaService,
    RolesGuard,
  ],
  exports: [ContenidoPublicoService, ContactoService, GaleriaService],
})
export class ContenidoPublicoModule {}
