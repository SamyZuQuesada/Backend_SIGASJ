import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Solicitud } from './solicitud.entity';
import { FormularioOficial } from './formulario-oficial.entity';

/**
 * Catálogo maestro de los tipos de trámites y solicitudes digitales oficiales en SIGASJ.
 * Permite identificar, habilitar/inhabilitar y consultar cada uno de los formularios
 * oficiales disponibles para los ciudadanos desde la página informativa.
 */
@Entity('TipoSolicitud')
@Index('UQ_TipoSolicitud_slug', ['slug'], { unique: true })
export class TipoSolicitud {
  @ApiProperty({
    example: 1,
    description: 'Identificador único numérico del tipo de solicitud',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 'Solicitud de Arreglo de Pago Domiciliar',
    description: 'Nombre oficial del trámite',
    maxLength: 150,
  })
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @ApiPropertyOptional({
    example:
      'Formulario oficial para solicitar un convenio de pago por servicios de agua potable.',
    description: 'Descripción detallada del trámite y su objetivo',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @ApiProperty({
    example: 'arreglo-pago',
    description:
      'Identificador amigable único utilizado para rutas públicas descriptivas (e.g., /solicitudes/arreglo-pago)',
    maxLength: 100,
  })
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @ApiProperty({
    example: true,
    description:
      'Indica si el trámite está habilitado para recibir nuevas solicitudes. Inactivar un tipo no elimina registros históricos.',
    default: true,
  })
  @Column({ default: true })
  activo: boolean;

  /**
   * Relación 1:N con la entidad central Solicitud (Backlog Solicitudes Digitales).
   * Al inactivar o dar mantenimiento a un TipoSolicitud, las solicitudes históricas
   * no se eliminan (sin eliminación en cascada).
   */
  @OneToMany(() => Solicitud, (solicitud) => solicitud.tipoSolicitud)
  solicitudes?: Solicitud[];

  /**
   * Documento oficial en formato PDF vigente asociado a este trámite.
   * Máximo un formulario vigente por cada uno de los 6 tipos oficiales.
   */
  @OneToOne(() => FormularioOficial, (formulario) => formulario.tipoSolicitud)
  formularioOficial?: FormularioOficial;

  @ApiProperty({
    description: 'Fecha y hora de registro del tipo de solicitud en el sistema',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de última modificación del tipo de solicitud',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
