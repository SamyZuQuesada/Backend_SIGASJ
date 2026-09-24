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
  { unique: true },
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
  @Column({ type: 'int' })
  idAveria: number;

  @ManyToOne(() => Averia, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idAveria', referencedColumnName: 'id' })
  averia: Averia;

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
