import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  EstadoEnvioSmsAveria,
  MotivoBloqueoSmsAveria,
} from '../../../common/enums/estado-envio-sms-averia.enum';
import { TipoEventoSmsAveria } from '../../../common/enums/tipo-evento-sms-averia.enum';
import { Averia } from '../../averias/entities/averia.entity';

/**
 * Registro de intento SMS. No almacena teléfono. El destinatario del
 * diagrama es el Reportante; el envío pasa por SmsAveriaSender (Infobip).
 */
@Entity('IntentoSmsAveria')
@Index('UQ_IntentoSmsAveria_averia_tipo', ['idAveria', 'tipoEvento'], {
  unique: true,
})
export class IntentoSmsAveria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  idAveria: number;

  @ManyToOne(() => Averia, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'idAveria', referencedColumnName: 'id' })
  averia: Averia;

  @Column({ type: 'varchar', length: 80 })
  tipoEvento: TipoEventoSmsAveria;

  @Column({ type: 'varchar', length: 40 })
  destinatarioClase: 'reportante';

  @Column({ type: 'varchar', length: 30 })
  estadoEnvio: EstadoEnvioSmsAveria;

  @Column({ type: 'varchar', length: 60 })
  motivoBloqueo: MotivoBloqueoSmsAveria;

  @CreateDateColumn()
  fechaCreacion: Date;
}
