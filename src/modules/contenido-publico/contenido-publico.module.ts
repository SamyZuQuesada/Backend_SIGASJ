import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContenidoPublicoService } from './contenido-publico.service';
import { ContenidoPublicoController } from './contenido-publico.controller';
import { ContactoUbicacion } from './entities/contacto-ubicacion.entity';
import { GaleriaFoto } from './entities/galeria-foto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContactoUbicacion, GaleriaFoto])],
  controllers: [ContenidoPublicoController],
  providers: [ContenidoPublicoService],
  exports: [ContenidoPublicoService],
})
export class ContenidoPublicoModule {}
