import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoAveria } from '../../../common/enums/estado-averia.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * Registro principal de una avería reportada a la ASADA.
 *
 * El Reportante puede ser un Abonado o una persona de la comunidad sin cuenta.
 * Por eso los datos de contacto se almacenan directamente en esta fila y la
 * relación con Abonado es opcional (`idAbonado` nulo).
 *
 * Decisiones de modelo:
 * - PK `id` (int identity), coherente con Material, Proveedor y ActividadFontanero.
 *   `MovimientoInventario.idAveria` ya anticipa esta convención.
 * - `fechaReporte` es el instante de negocio del reporte. `createdAt`/`updatedAt`
 *   son auditoría técnica. En un alta normal coinciden, pero no se fusionan:
 *   una actualización posterior no debe reinterpretar cuándo se reportó.
 * - No existe entidad `Abonado` ni catálogos `TipoAveria`/`PrioridadAveria`.
 *   `idAbonado`, `tipoAveria` y `prioridad` quedan como columnas compatibles
 *   (enteros/texto nulos) hasta esas tareas.
 * - El Fontanero se representa con `Usuario` + rol FONTANERO. La entidad no
 *   valida el rol; eso corresponde al service de asignación.
 */
@Entity('Averia')
export class Averia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  codigoSeguimiento: string;

  @Column({ type: 'datetime' })
  fechaReporte: Date;

  @Column({ type: 'varchar', length: 150 })
  nombreReportante: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  identificacionReportante: string | null;

  @Column({ type: 'varchar', length: 50 })
  telefonoReportante: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  correoReportante: string | null;

  /**
   * FK lógica futura hacia Abonado. Hoy no hay tabla/entidad Abonado;
   * se persiste el id opcional sin relación TypeORM ni constraint FK.
   */
  @Column({ type: 'int', nullable: true })
  idAbonado: number | null;

  @Column({ type: 'varchar', length: 500 })
  ubicacion: string;

  @Column({ type: 'varchar', length: 150 })
  sectorComunidad: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({
    type: 'varchar',
    length: 40,
    default: EstadoAveria.RECIBIDA,
  })
  estado: EstadoAveria;

  /**
   * Clasificación administrativa. Nula en el reporte inicial.
   * No se crea catálogo TipoAveria en esta tarea.
   */
  @Column({ type: 'varchar', length: 80, nullable: true })
  tipoAveria: string | null;

  /**
   * Prioridad administrativa. Nula en el reporte inicial.
   * No se inventa catálogo Alta/Media/Baja hasta que exista formalmente.
   */
  @Column({ type: 'varchar', length: 40, nullable: true })
  prioridad: string | null;

  @Column({ type: 'int', nullable: true })
  idFontaneroAsignado: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'idFontaneroAsignado',
    referencedColumnName: 'idUsuario',
  })
  fontaneroAsignado: Usuario | null;

  @Column({ type: 'datetime', nullable: true })
  fechaAsignacion: Date | null;

  @Column({ type: 'datetime', nullable: true })
  fechaInicioAtencion: Date | null;

  @Column({ type: 'datetime', nullable: true })
  fechaResolucion: Date | null;

  @Column({ type: 'text', nullable: true })
  observacionesAtencion: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  asignarFechaReporte(): void {
    if (!this.fechaReporte) {
      this.fechaReporte = new Date();
    }
  }
}
