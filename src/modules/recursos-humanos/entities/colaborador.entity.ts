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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JornadaLaboral } from '../../../common/enums/jornada-laboral.enum';
import { ModalidadPago } from '../../../common/enums/modalidad-pago.enum';
import { SolicitudAusencia } from '../../solicitudes-ausencia/entities/solicitud-ausencia.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import {
  AntiguedadLaboral,
  calcularAntiguedad,
} from '../antiguedad-laboral';
import { Incapacidad } from './incapacidad.entity';
import { MovimientoVacaciones } from './movimiento-vacaciones.entity';
import { PermisoColaborador } from './permiso-colaborador.entity';
import { Puesto } from './puesto.entity';

/**
 * Personal administrado desde Recursos Humanos (fontaneros y personal
 * administrativo). La cuenta de usuario es opcional: un colaborador puede
 * existir sin acceso a SIGASJ.
 */
@Entity('Colaborador')
@Index('UQ_Colaborador_cedula', ['cedula'], { unique: true })
@Index('UQ_Colaborador_usuarioId', ['usuarioId'], {
  unique: true,
  // SQL Server trata NULL como valor en UNIQUE; sin el filtro solo se
  // permitiría un colaborador sin cuenta.
  where: '"usuarioId" IS NOT NULL',
})
export class Colaborador {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del colaborador',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 'Carlos',
    description: 'Nombre de pila del colaborador',
  })
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @ApiProperty({
    example: 'Pérez Mora',
    description: 'Apellidos del colaborador',
  })
  @Column({ type: 'varchar', length: 100 })
  apellidos: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Cédula de identidad única del colaborador',
  })
  @Column({ type: 'varchar', length: 30 })
  cedula: string;

  @ApiProperty({
    example: 'carlos.perez@asadasanjuan.cr',
    description: 'Correo electrónico de contacto del colaborador',
  })
  @Column({ type: 'varchar', length: 150 })
  correoElectronico: string;

  @ApiProperty({
    example: 'Fontanero',
    description:
      'Nombre del puesto (sincronizado desde Puesto.nombre por compatibilidad)',
  })
  @Column({ type: 'varchar', length: 100 })
  cargo: string;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description: 'Puesto del catálogo formal',
  })
  @Column({ type: 'int', nullable: true })
  puestoId: number | null;

  @ManyToOne(() => Puesto, (puesto) => puesto.colaboradores, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'puestoId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_Colaborador_Puesto',
  })
  puesto: Puesto | null;

  @ApiProperty({
    example: true,
    description: 'Estado activo/inactivo del colaborador',
    default: true,
  })
  @Column({ default: true })
  activo: boolean;

  @ApiProperty({
    example: 5,
    nullable: true,
    description:
      'Cuenta de usuario de SIGASJ asociada. NULL si el colaborador no tiene acceso al sistema',
  })
  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'usuarioId',
    referencedColumnName: 'idUsuario',
    foreignKeyConstraintName: 'FK_Colaborador_Usuario',
  })
  usuario: Usuario | null;

  @ApiPropertyOptional({
    example: '2020-03-15',
    nullable: true,
    description:
      'Fecha real de ingreso laboral (YYYY-MM-DD). Distinta de createdAt. Nullable para registros legacy.',
  })
  // varchar(10): evita el desfase de un día del driver mssql con columnas DATE.
  @Column({ type: 'varchar', length: 10, nullable: true })
  fechaIngreso: string | null;

  @ApiPropertyOptional({
    enum: JornadaLaboral,
    nullable: true,
    description: 'Jornada laboral aplicable al colaborador',
  })
  @Column({ type: 'varchar', length: 20, nullable: true })
  jornadaLaboral: JornadaLaboral | null;

  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    description: 'Cantidad habitual de días laborales por semana (1–7)',
  })
  @Column({ type: 'smallint', nullable: true })
  diasLaboralesHabituales: number | null;

  @ApiPropertyOptional({
    enum: ModalidadPago,
    nullable: true,
    description: 'Modalidad de pago habitual (base para política de vacaciones)',
  })
  @Column({ type: 'varchar', length: 20, nullable: true })
  modalidadPago: ModalidadPago | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Antigüedad calculada desde fechaIngreso (no persistida). Null si no hay fecha de ingreso.',
  })
  antiguedad: AntiguedadLaboral | null;

  @OneToMany(() => PermisoColaborador, (permiso) => permiso.colaborador)
  permisos: PermisoColaborador[];

  @OneToMany(() => MovimientoVacaciones, (movimiento) => movimiento.colaborador)
  movimientosVacaciones: MovimientoVacaciones[];

  @OneToMany(() => Incapacidad, (incapacidad) => incapacidad.colaborador)
  incapacidades: Incapacidad[];

  @OneToMany(() => SolicitudAusencia, (solicitud) => solicitud.colaborador)
  solicitudesAusencia: SolicitudAusencia[];

  @ApiProperty({
    description: 'Fecha y hora de creación del registro',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última modificación del registro',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  asignarValoresPorDefecto(): void {
    if (this.activo === undefined) {
      this.activo = true;
    }
  }

  @AfterLoad()
  hidratarAntiguedad(): void {
    this.antiguedad = calcularAntiguedad(this.fechaIngreso);
  }

  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    if (this.nombre) {
      this.nombre = this.nombre.trim();
    }
    if (this.apellidos) {
      this.apellidos = this.apellidos.trim();
    }
    if (this.cedula) {
      this.cedula = this.cedula.trim();
    }
    if (this.correoElectronico) {
      this.correoElectronico = this.correoElectronico.trim().toLowerCase();
    }
    if (this.cargo) {
      this.cargo = this.cargo.trim();
    }
    if (typeof this.fechaIngreso === 'string') {
      const limpia = this.fechaIngreso.trim();
      this.fechaIngreso = limpia === '' ? null : limpia;
    }
  }
}
