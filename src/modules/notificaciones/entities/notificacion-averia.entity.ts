import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoNotificacionAveria } from '../../../common/enums/tipo-notificacion-averia.enum';
import { Averia } from '../../averias/entities/averia.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('NotificacionAveria')
@Index(
  'UQ_NotificacionAveria_destinatario_averia_tipo',
  ['idUsuarioDestinatario', 'idAveria', 'tipo'],
  { unique: true, where: '"idAveria" IS NOT NULL' },
)
@Index(
  'UQ_NotificacionAveria_destinatario_solicitud_tipo',
  ['idUsuarioDestinatario', 'idSolicitudAusencia', 'tipo'],
  { unique: true, where: '"idSolicitudAusencia" IS NOT NULL' },
)
@Index(
  'UQ_NotificacionAveria_destinatario_solicitud_materiales_tipo',
  ['idUsuarioDestinatario', 'idSolicitudMateriales', 'tipo'],
  { unique: true, where: '"idSolicitudMateriales" IS NOT NULL' },
)
@Index(
  'UQ_NotificacionAveria_destinatario_salida_inventario_tipo',
  ['idUsuarioDestinatario', 'idSalidaInventario', 'tipo'],
  { unique: true, where: '"idSalidaInventario" IS NOT NULL' },
)
@Index(
  'UQ_NotificacionAveria_destinatario_reposicion_tipo',
  ['idUsuarioDestinatario', 'idReposicion', 'tipo'],
  { unique: true, where: '"idReposicion" IS NOT NULL' },
)
@Index(
  'UQ_NotificacionAveria_destinatario_actividad_tipo',
  ['idUsuarioDestinatario', 'idActividad', 'tipo'],
  { unique: true, where: '"idActividad" IS NOT NULL' },
)
@Index('IX_NotificacionAveria_destinatario_leida_fecha', [
  'idUsuarioDestinatario',
  'leida',
  'fechaCreacion',
])
export class NotificacionAveria {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IX_NotificacionAveria_idUsuarioDestinatario')
  @Column({ type: 'int' })
  idUsuarioDestinatario: number;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({
    name: 'idUsuarioDestinatario',
    referencedColumnName: 'idUsuario',
  })
  destinatario: Usuario;

  @Index('IX_NotificacionAveria_idAveria')
  @Column({ type: 'int', nullable: true })
  idAveria: number | null;

  @ManyToOne(() => Averia, {
    nullable: true,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idAveria', referencedColumnName: 'id' })
  averia: Averia | null;

  /**
   * FK a SolicitudAusencia (migración). Sin @ManyToOne para no acoplar
   * el metadata de averías/tests a todo el grafo RRHH.
   */
  @Index('IX_NotificacionAveria_idSolicitudAusencia')
  @Column({ type: 'int', nullable: true })
  idSolicitudAusencia: number | null;

  @Index('IX_NotificacionAveria_idSolicitudMateriales')
  @Column({ type: 'int', nullable: true })
  idSolicitudMateriales: number | null;

  @Index('IX_NotificacionAveria_idSalidaInventario')
  @Column({ type: 'int', nullable: true })
  idSalidaInventario: number | null;

  @Index('IX_NotificacionAveria_idReposicion')
  @Column({ type: 'int', nullable: true })
  idReposicion: number | null;

  /** FK a ActividadFontanero (migración). Sin @ManyToOne para no acoplar el grafo. */
  @Index('IX_NotificacionAveria_idActividad')
  @Column({ type: 'int', nullable: true })
  idActividad: number | null;

  @Column({ type: 'varchar', length: 80 })
  tipo: TipoNotificacionAveria;

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

  @Column({ type: 'varchar', length: 400 })
  mensaje: string;

  @Column({ default: false })
  leida: boolean;

  @Column({ type: 'datetime', nullable: true })
  fechaLectura: Date | null;

  @CreateDateColumn()
  fechaCreacion: Date;
}
