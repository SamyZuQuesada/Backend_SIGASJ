import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { TipoSolicitudNoEncontradoException } from './errors/solicitud.errors';

@Injectable()
export class TiposSolicitudService {
  private readonly logger = new Logger(TiposSolicitudService.name);

  constructor(
    @InjectRepository(TipoSolicitud)
    private readonly tipoSolicitudRepository: Repository<TipoSolicitud>,
  ) {}

  /**
   * Obtiene todos los tipos de solicitudes oficiales activos disponibles en SIGASJ.
   * Utilizado para alimentar la oferta de trámites en el portal informativo público.
   */
  async findActivos(): Promise<TipoSolicitud[]> {
    return this.tipoSolicitudRepository.find({
      where: { activo: true },
      relations: { formularioOficial: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Obtiene todos los tipos de solicitudes registrados (activos e inactivos) para gestión interna.
   */
  async findAll(): Promise<TipoSolicitud[]> {
    return this.tipoSolicitudRepository.find({
      relations: { formularioOficial: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Consulta un tipo de trámite oficial a través de su slug amigable (e.g., 'arreglo-pago').
   * Permite cargar la configuración del formulario en la ruta correspondiente.
   *
   * @throws TipoSolicitudNoEncontradoException si el slug no existe o está inactivo cuando soloActivos=true.
   */
  async findBySlug(slug: string, soloActivos = true): Promise<TipoSolicitud> {
    const slugNormalizado = slug?.trim().toLowerCase();

    const where: Record<string, any> = { slug: slugNormalizado };
    if (soloActivos) {
      where.activo = true;
    }

    const tipo = await this.tipoSolicitudRepository.findOne({
      where,
      relations: { formularioOficial: true },
    });

    if (!tipo) {
      this.logger.warn(
        `Tipo de solicitud con slug '${slugNormalizado}' no encontrado (soloActivos: ${soloActivos})`,
      );
      throw new TipoSolicitudNoEncontradoException(slugNormalizado);
    }

    return tipo;
  }

  /**
   * Consulta un tipo de trámite oficial por su identificador numérico primario.
   *
   * @throws TipoSolicitudNoEncontradoException si el ID no existe.
   */
  async findById(id: number): Promise<TipoSolicitud> {
    const tipo = await this.tipoSolicitudRepository.findOne({
      where: { id },
      relations: { formularioOficial: true },
    });

    if (!tipo) {
      this.logger.warn(`Tipo de solicitud con ID ${id} no encontrado`);
      throw new TipoSolicitudNoEncontradoException(id);
    }

    return tipo;
  }

  /**
   * Activa o inactiva un tipo de solicitud sin afectar ni eliminar registros históricos.
   */
  async cambiarEstadoActivo(
    id: number,
    activo: boolean,
  ): Promise<TipoSolicitud> {
    const tipo = await this.findById(id);
    tipo.activo = activo;
    return this.tipoSolicitudRepository.save(tipo);
  }
}
