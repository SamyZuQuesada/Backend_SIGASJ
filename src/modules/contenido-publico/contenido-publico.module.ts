import { Module } from '@nestjs/common';
import { ContenidoPublicoService } from './contenido-publico.service';
import { ContenidoPublicoController } from './contenido-publico.controller';

@Module({
  controllers: [ContenidoPublicoController],
  providers: [ContenidoPublicoService],
  exports: [ContenidoPublicoService],
})
export class ContenidoPublicoModule {}
