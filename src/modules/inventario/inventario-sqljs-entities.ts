/**
 * Entidades TypeORM para suites QA de inventario sobre sqljs.
 * Incluye ObservacionAveria porque Averia declara @OneToMany observaciones.
 */
import { Averia } from '../averias/entities/averia.entity';
import { ObservacionAveria } from '../averias/entities/observacion-averia.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AlertaReposicion } from './entities/alerta-reposicion.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DetalleReposicionMaterial } from './entities/detalle-reposicion-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { ReposicionMaterial } from './entities/reposicion-material.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';

export const INVENTARIO_SQLJS_ENTITIES = [
  Usuario,
  Rol,
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
  ObservacionAveria,
] as const;
