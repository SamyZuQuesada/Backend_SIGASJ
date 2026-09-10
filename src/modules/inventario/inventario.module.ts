import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { Material } from './entities/material.entity';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';

@Module({
  imports: [TypeOrmModule.forFeature([Material, CategoriaMaterial])],
  controllers: [InventarioController],
  providers: [InventarioService, RolesGuard],
  exports: [TypeOrmModule, InventarioService],
})
export class InventarioModule {}
