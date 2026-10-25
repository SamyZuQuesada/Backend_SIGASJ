import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Formulario adicional publicado por la ASADA para descarga pública.
 *
 * Distinto de FormularioOficial (PDF 1:1 por TipoSolicitud / trámite).
 * El archivo se referencia con ruta relativa de storage (mismo patrón que
 * FormularioOficial), sin rutas físicas del servidor ni binario en BD.
 *
 * `activo` controla visibilidad pública; no implica borrado físico.
 * `fechaPublicacion` es independiente de `createdAt` (borrador sin publicar).
 */
@Entity('FormularioDescargable')
export class FormularioDescargable {
  @PrimaryGeneratedColumn()
  id: number;

  /** Nombre visible del formulario (catálogo público). */
  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  /** Explicación breve para el ciudadano; opcional. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  descripcion: string | null;

  /** Nombre original del archivo subido (para mostrar / Content-Disposition). */
  @Column({ type: 'varchar', length: 255 })
  nombreArchivoOriginal: string;

  /** Nombre único interno seguro en el almacenamiento. */
  @Column({ type: 'varchar', length: 255 })
  nombreArchivoInterno: string;

  /**
   * Ruta relativa en storage (p. ej. formularios-descargables/uuid.pdf).
   * No almacena rutas absolutas del servidor.
   */
  @Column({ type: 'varchar', length: 255 })
  ubicacionArchivo: string;

  /**
   * Disponible públicamente cuando es true.
   * Default false: se publica de forma explícita (mismo criterio que Proyecto).
   */
  @Column({ default: false })
  activo: boolean;

  /**
   * Momento de publicación oficial.
   * Nullable: permite borrador (activo=false) antes de publicar.
   */
  @Column({ type: 'datetime2', nullable: true })
  fechaPublicacion: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;
}
