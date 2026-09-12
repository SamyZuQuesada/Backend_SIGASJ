import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AveriasAdminController } from './averias-admin.controller';
import { AveriasController } from './averias.controller';
import { AveriasService } from './averias.service';
import { Averia } from './entities/averia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Averia])],
  controllers: [AveriasController, AveriasAdminController],
  providers: [AveriasService],
  exports: [TypeOrmModule, AveriasService],
})
export class AveriasModule {}
