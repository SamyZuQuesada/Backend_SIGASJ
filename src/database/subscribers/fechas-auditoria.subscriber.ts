import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

type Fila = Record<string, unknown>;

/**
 * Las columnas de auditoría (@CreateDateColumn / @UpdateDateColumn) las rellenaba
 * la base con GETDATE() o CURRENT_TIMESTAMP, que devuelven la hora LOCAL del
 * servidor SQL. El driver las lee como UTC (useUTC: true), así que con un SQL
 * Server instalado en Costa Rica (UTC-6) se veían 6 horas atrasadas.
 *
 * Este suscriptor las escribe desde la aplicación con un instante UTC real, sin
 * depender del huso horario del servidor de base de datos.
 */
@EventSubscriber()
export class FechasAuditoriaSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<Fila>): void {
    const entidad = event.entity;
    if (!entidad) {
      return;
    }
    const ahora = new Date();
    for (const columna of event.metadata.columns) {
      if (
        (columna.isCreateDate || columna.isUpdateDate) &&
        entidad[columna.propertyName] == null
      ) {
        entidad[columna.propertyName] = ahora;
      }
    }
  }

  beforeUpdate(event: UpdateEvent<Fila>): void {
    const entidad = event.entity;
    if (!entidad) {
      return;
    }
    const ahora = new Date();
    for (const columna of event.metadata.columns) {
      if (columna.isUpdateDate) {
        entidad[columna.propertyName] = ahora;
      }
    }
  }
}
