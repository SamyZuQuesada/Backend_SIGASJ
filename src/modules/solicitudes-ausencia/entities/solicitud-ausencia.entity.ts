import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AfterLoad,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoSolicitudAusencia } from '../../../common/enums/estado-solicitud-ausencia.enum';
import { TipoRegistroGeneradoAusencia } from '../../../common/enums/tipo-registro-generado-ausencia.enum';
import { TipoSolicitudAusencia } from '../../../common/enums/tipo-solicitud-ausencia.enum';
import { aFechaIso } from '../../recursos-humanos/fecha-permiso';
import { Colaborador } from '../../recursos-humanos/entities/colaborador.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DocumentoSolicitudAusencia } from './documento-solicitud-ausencia.entity';

/**
 * Solicitud de permiso o vacaciones del Fontanero (persistencia épica 6.5).
 * No es un permiso/vacación aprobada: PENDIENTE no crea registros RRHH.
 */
@Entity('SolicitudAusencia')
@Index('UQ_SolicitudAusencia_jotformSubmissionId', ['jotformSubmissionId'], {
  unique: true,
})
@Index('IX_SolicitudAusencia_colaboradorId', ['colaboradorId'])
@Index('IX_SolicitudAusencia_estado', ['estado'])
export class SolicitudAusencia {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 3 })
  @Column({ type: 'int' })
  colaboradorId: number;

  @ManyToOne(
    () => Colaborador,
    (colaborador) => colaborador.solicitudesAusencia,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'colaboradorId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_SolicitudAusencia_Colaborador',
  })
  colaborador: Colaborador;

  @ApiProperty({ enum: TipoSolicitudAusencia })
  @Column({ type: 'varchar', length: 20 })
  tipo: TipoSolicitudAusencia;

  /** Primer día del periodo (YYYY-MM-DD). varchar(10) como Permiso/Incapacidad. */
  @ApiProperty({ example: '2026-11-01' })
  @Column({ type: 'varchar', length: 10 })
  fechaInicio: string;

  /** Último día del periodo (YYYY-MM-DD). */
  @ApiProperty({ example: '2026-11-05' })
  @Column({ type: 'varchar', length: 10 })
  fechaFin: string;

  /** Motivo escrito por el Fontanero al solicitar. */
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  motivo: string | null;

  /**
   * Correo indicado por el Fontanero al solicitar.
   * Se usa para notificar la aprobación (no sustituye la identidad JWT).
   */
  @ApiPropertyOptional({ nullable: true, example: 'fontanero@asadasanjuan.cr' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  correoNotificacion: string | null;

  /** Observaciones administrativas (vacías mientras PENDIENTE). */
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @ApiProperty({ enum: EstadoSolicitudAusencia })
  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoSolicitudAusencia.PENDIENTE,
  })
  estado: EstadoSolicitudAusencia;

  /** Identificador textual de la submission de Jotform (único). */
  @ApiProperty({ description: 'ID único de submission de Jotform' })
  @Column({ type: 'varchar', length: 64 })
  jotformSubmissionId: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'idUsuario de quien aprobó o rechazó',
  })
  @Column({ type: 'int', nullable: true })
  reviewedByUsuarioId: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'reviewedByUsuarioId',
    referencedColumnName: 'idUsuario',
    foreignKeyConstraintName: 'FK_SolicitudAusencia_UsuarioRevisor',
  })
  revisadoPor: Usuario | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  motivoRechazo: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'ID del PermisoColaborador o MovimientoVacaciones generado (post-aprobación)',
  })
  @Column({ type: 'int', nullable: true })
  registroGeneradoId: number | null;

  @ApiPropertyOptional({ enum: TipoRegistroGeneradoAusencia, nullable: true })
  @Column({ type: 'varchar', length: 40, nullable: true })
  registroGeneradoTipo: TipoRegistroGeneradoAusencia | null;

  @OneToMany(
    () => DocumentoSolicitudAusencia,
    (documento) => documento.solicitud,
  )
  documentos?: DocumentoSolicitudAusencia[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  hidratarFechas(): void {
    if (this.fechaInicio) this.fechaInicio = aFechaIso(this.fechaInicio);
    if (this.fechaFin) this.fechaFin = aFechaIso(this.fechaFin);
  }

  @BeforeInsert()
  asignarValoresPorDefecto(): void {
    if (!this.estado) {
      this.estado = EstadoSolicitudAusencia.PENDIENTE;
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    if (this.fechaInicio) this.fechaInicio = aFechaIso(this.fechaInicio);
    if (this.fechaFin) this.fechaFin = aFechaIso(this.fechaFin);
    if (this.motivo) this.motivo = this.motivo.trim();
    else if (this.motivo === '') this.motivo = null;
    if (this.correoNotificacion) {
      this.correoNotificacion = this.correoNotificacion.trim().toLowerCase();
    } else if (this.correoNotificacion === '') {
      this.correoNotificacion = null;
    }
    if (this.observaciones) this.observaciones = this.observaciones.trim();
    else if (this.observaciones === '') this.observaciones = null;
    if (this.motivoRechazo) this.motivoRechazo = this.motivoRechazo.trim();
    else if (this.motivoRechazo === '') this.motivoRechazo = null;
    if (this.jotformSubmissionId) {
      this.jotformSubmissionId = this.jotformSubmissionId.trim();
    }
  }
}
