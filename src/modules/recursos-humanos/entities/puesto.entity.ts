import { ApiProperty } from '@nestjs/swagger';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Colaborador } from './colaborador.entity';

@Entity('Puesto')
@Index('UQ_Puesto_nombre', ['nombre'], { unique: true })
export class Puesto {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Fontanero' })
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @ApiProperty({
    example: true,
    description:
      'Si es crítico para continuidad operativa (cobertura). Sin reglas cargadas no bloquea.',
  })
  @Column({ default: false })
  critico: boolean;

  @ApiProperty({ example: true })
  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => Colaborador, (colaborador) => colaborador.puesto)
  colaboradores: Colaborador[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    if (this.nombre) this.nombre = this.nombre.trim();
    if (this.activo === undefined) this.activo = true;
    if (this.critico === undefined) this.critico = false;
  }
}
