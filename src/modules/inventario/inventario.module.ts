import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Material,
      CategoriaMaterial,
      Proveedor,
      MovimientoInventario,
      DocumentoMovimientoInventario,
    ]),
  ],
  controllers: [InventarioController],
  providers: [InventarioService, RolesGuard],
  exports: [TypeOrmModule, InventarioService],
})
export class InventarioModule {}
