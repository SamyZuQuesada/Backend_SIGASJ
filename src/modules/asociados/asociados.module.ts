import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asociado } from './entities/asociado.entity';
import { AsociadosService } from './asociados.service';
import { AsociadosController } from './asociados.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Asociado])],
  controllers: [AsociadosController],
  providers: [AsociadosService],
  exports: [TypeOrmModule, AsociadosService],
})
export class AsociadosModule {}
