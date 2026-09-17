import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { AlertaReposicion } from './entities/alerta-reposicion.entity';
import { ReposicionMaterial } from './entities/reposicion-material.entity';
import { DetalleReposicionMaterial } from './entities/detalle-reposicion-material.entity';
import { Averia } from '../averias/entities/averia.entity';
import { InventarioController } from './inventario.controller';
import { SolicitudesMaterialesController } from './solicitudes-materiales.controller';
import { AlertasReposicionController } from './alertas-reposicion.controller';
import { ReposicionesController } from './reposiciones.controller';
import { RecepcionesController } from './recepciones.controller';
import { InventarioService } from './inventario.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Material,
      CategoriaMaterial,
      Proveedor,
      MovimientoInventario,
      DocumentoMovimientoInventario,
      SolicitudMaterial,
      DetalleSolicitudMaterial,
      AlertaReposicion,
      ReposicionMaterial,
      DetalleReposicionMaterial,
      Averia,
    ]),
  ],
  controllers: [
    InventarioController,
    SolicitudesMaterialesController,
    AlertasReposicionController,
    ReposicionesController,
    RecepcionesController,
  ],
  providers: [InventarioService, RolesGuard],
  exports: [TypeOrmModule, InventarioService],
})
export class InventarioModule {}
