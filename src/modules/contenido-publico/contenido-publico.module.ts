import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContenidoPublicoService } from './contenido-publico.service';
import { ContenidoPublicoController } from './contenido-publico.controller';
import { ContactoUbicacion } from './entities/contacto-ubicacion.entity';
import { FormularioDescargable } from './entities/formulario-descargable.entity';
import { FormulariosDescargablesPublicController } from './formularios-descargables-public.controller';
import { FormulariosDescargablesController } from './formularios-descargables.controller';
import { FormulariosDescargablesService } from './formularios-descargables.service';
import { GaleriaFoto } from './entities/galeria-foto.entity';
import { TransparenciaDocumento } from './entities/transparencia-documento.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContactoUbicacion,
      FormularioDescargable,
      GaleriaFoto,
      TransparenciaDocumento,
    ]),
  ],
  controllers: [
    ContenidoPublicoController,
    FormulariosDescargablesController,
    FormulariosDescargablesPublicController,
  ],
  providers: [ContenidoPublicoService, FormulariosDescargablesService],
  exports: [ContenidoPublicoService, FormulariosDescargablesService],
})
export class ContenidoPublicoModule {}
