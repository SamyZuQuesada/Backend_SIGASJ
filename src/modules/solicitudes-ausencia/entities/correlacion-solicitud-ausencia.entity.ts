import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Token de un solo uso que vincula la sesión JWT del Fontanero
 * con la submission de Jotform (campo oculto). Evita spoofing de colaboradorId.
 */
@Entity('CorrelacionSolicitudAusencia')
@Index('UQ_CorrelacionSolicitudAusencia_token', ['token'], { unique: true })
export class CorrelacionSolicitudAusencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  token: string;

  @Column({ type: 'int' })
  colaboradorId: number;

  @Column({ type: 'int' })
  usuarioId: number;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  jotformSubmissionId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
