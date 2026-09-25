import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { HistorialAveria } from './entities/historial-averia.entity';
import {
  registrarEventoHistorialEnManager,
  type RegistrarEventoHistorialInput,
} from './historial-averias.registro';

/**
 * Alta de eventos históricos. No expone actualización ni eliminación:
 * cada llamada inserta una fila nueva con la hora del servidor.
 */
@Injectable()
export class HistorialAveriasService {
  constructor(
    @InjectRepository(HistorialAveria)
    private readonly historialRepository: Repository<HistorialAveria>,
  ) {}

  registrar(
    input: RegistrarEventoHistorialInput,
    manager?: EntityManager,
  ): Promise<void> {
    return registrarEventoHistorialEnManager(
      manager ?? this.historialRepository.manager,
      input,
    );
  }
}
