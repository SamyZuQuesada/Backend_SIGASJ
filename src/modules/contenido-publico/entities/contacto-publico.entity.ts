import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ContactoPublico')
export class ContactoPublico {
  @PrimaryGeneratedColumn()
  idContactoPublico: number;

  @Column({ type: 'varchar', length: 30 })
  telefono: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  telefonosAdicionalesJson: string | null;

  @Column({ type: 'varchar', length: 200 })
  email: string;

  @Column({ type: 'varchar', length: 300 })
  horarioAtencion: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  horarioVentanilla: string | null;

  @Column({ type: 'varchar', length: 500 })
  direccion: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  referenciaUbicacion: string | null;

  @Column({ type: 'varchar', length: 200 })
  regionResumen: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  mapaUrl: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  mapaLatitud: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  mapaLongitud: number | null;

  @Column({ type: 'int', default: 18 })
  mapaZoom: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  textoUbicacionMapa: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  urlFacebook: string | null;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  descripcionContacto: string | null;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
