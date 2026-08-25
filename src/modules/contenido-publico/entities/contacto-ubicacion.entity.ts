import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('ContactoUbicacion')
export class ContactoUbicacion {
  @PrimaryColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  telefono: string;

  @Column({ type: 'varchar', length: 120 })
  email: string;

  @Column({ type: 'varchar', length: 240 })
  direccion: string;

  @Column({ type: 'varchar', length: 240 })
  horarioAtencion: string;

  @Column({ type: 'varchar', length: 240, default: '' })
  referenciaUbicacion: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  mapaUrl: string;

  @Column({ type: 'float' })
  latitud: number;

  @Column({ type: 'float' })
  longitud: number;

  @Column({ type: 'float', default: 19 })
  zoomMapa: number;
}
