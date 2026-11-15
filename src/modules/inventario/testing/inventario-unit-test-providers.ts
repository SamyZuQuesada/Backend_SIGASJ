import { getRepositoryToken } from '@nestjs/typeorm';
import { Averia } from '../../averias/entities/averia.entity';
import { NotificacionesAveriasService } from '../../notificaciones/notificaciones-averias.service';
import { AlertaReposicion } from '../entities/alerta-reposicion.entity';
import { DetalleReposicionMaterial } from '../entities/detalle-reposicion-material.entity';
import { DetalleSolicitudMaterial } from '../entities/detalle-solicitud-material.entity';
import { ReposicionMaterial } from '../entities/reposicion-material.entity';
import { SolicitudMaterial } from '../entities/solicitud-material.entity';

const emptyRepo = () => ({
  create: jest.fn((dto) => dto),
  save: jest.fn((row) => Promise.resolve({ id: 1, ...row })),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findOneBy: jest.fn().mockResolvedValue(null),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

/** Solo deps de solicitudes / notificaciones (evita duplicar Averia/Alertas ya mockeadas). */
export const inventarioSolicitudNotificacionProviders = [
  { provide: getRepositoryToken(SolicitudMaterial), useValue: emptyRepo() },
  {
    provide: getRepositoryToken(DetalleSolicitudMaterial),
    useValue: emptyRepo(),
  },
  {
    provide: NotificacionesAveriasService,
    useValue: {
      notificarAsignacionAveria: jest.fn(),
      notificarStockBajo: jest.fn(),
      notificarAdministradorasSalidaInventario: jest.fn(),
      notificarAdministradorasAlertaReposicion: jest.fn(),
      notificarAdministradorasSolicitudMaterialesPendiente: jest.fn(),
      notificarFontaneroSolicitudMaterialesAprobada: jest.fn(),
      notificarFontaneroSolicitudMaterialesRechazada: jest.fn(),
    },
  },
];

/** Providers faltantes frecuentes en unit tests de InventarioService. */
export const inventarioServiceExtraProviders = [
  ...inventarioSolicitudNotificacionProviders,
  { provide: getRepositoryToken(Averia), useValue: emptyRepo() },
  { provide: getRepositoryToken(AlertaReposicion), useValue: emptyRepo() },
  { provide: getRepositoryToken(ReposicionMaterial), useValue: emptyRepo() },
  {
    provide: getRepositoryToken(DetalleReposicionMaterial),
    useValue: emptyRepo(),
  },
];
