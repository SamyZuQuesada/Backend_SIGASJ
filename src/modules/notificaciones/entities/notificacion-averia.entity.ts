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
