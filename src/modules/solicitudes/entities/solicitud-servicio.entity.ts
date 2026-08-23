import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SolicitudEstado } from '../../../common/enums/solicitud-estado.enum';

@Entity('SolicitudServicio')
export class SolicitudServicio {
  @PrimaryGeneratedColumn()
  idSolicitud: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  apellidos: string;

  @Column({ type: 'varchar', length: 20 })
  cedula: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 120 })
  correo: string;

  @Column({ type: 'varchar', length: 300 })
  direccion: string;

  @Column({ type: 'varchar', length: 20, default: SolicitudEstado.PENDIENTE })
  estado: SolicitudEstado;

  @Column({ default: false })
  utilizada: boolean;

  @Column({ type: 'int', nullable: true })
  idAbonadoRegistrado: number | null;
}
