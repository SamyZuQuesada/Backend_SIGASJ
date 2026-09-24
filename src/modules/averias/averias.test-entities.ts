import { DataSource } from 'typeorm';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { IntentoSmsAveria } from '../notificaciones/entities/intento-sms-averia.entity';
import { NotificacionAveria } from '../notificaciones/entities/notificacion-averia.entity';

/** Entidades sqljs para specs que importan AveriasModule (PBI 2.8). */
export const AVERIAS_TEST_ENTITIES = [
  Averia,
  ObservacionAveria,
  Usuario,
  Rol,
  HorarioLaboralFontanero,
  NotificacionAveria,
  IntentoSmsAveria,
] as const;

export async function vaciarNotificacionesAveriaPrueba(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.getRepository(NotificacionAveria).clear();
  await dataSource.getRepository(IntentoSmsAveria).clear();
}
