import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Abonado } from './entities/abonado.entity';

@Injectable()
export class AbonadosService {
  private readonly logger = new Logger(AbonadosService.name);

  constructor(
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
  ) {}

  async findOwn(user: AuthenticatedUser): Promise<Abonado> {
    return this.requireOwnAbonado(user);
  }

  async findOneForRequester(
    idAbonado: number,
    user: AuthenticatedUser,
  ): Promise<Abonado> {
    if (user.role === Role.ADMINISTRADORA) {
      const abonado = await this.abonadoRepository.findOne({
        where: { idAbonado },
      });
      if (!abonado) {
        throw new NotFoundException('Abonado no encontrado');
      }
      return abonado;
    }

    return this.requireOwnAbonadoById(user, idAbonado);
  }

  /**
   * Identidad del Abonado desde la sesión (request.user.userId → Abonado.idUsuario).
   * No usa ids de body, query ni params.
   */
  async requireOwnAbonado(user: AuthenticatedUser): Promise<Abonado> {
    const idUsuario = this.idUsuarioDesdeSesion(user);
    const own = await this.abonadoRepository.findOne({ where: { idUsuario } });
    if (!own) {
      throw new NotFoundException(
        'No existe un abonado asociado al usuario autenticado',
      );
    }
    return own;
  }

  /**
   * Comprueba propiedad en base de datos: idAbonado + idUsuario de sesión.
   * Si el registro no es propio, 403 (no se carga el padrón ni el registro ajeno).
   */
  async requireOwnAbonadoById(
    user: AuthenticatedUser,
    idAbonado: number,
  ): Promise<Abonado> {
    const idUsuario = this.idUsuarioDesdeSesion(user);
    const own = await this.abonadoRepository.findOne({
      where: { idAbonado, idUsuario },
    });
    if (!own) {
      this.logger.warn(
        `Acceso denegado a recurso de abonado (rol=${user.role})`,
      );
      throw new ForbiddenException('Acceso denegado');
    }
    return own;
  }

  private idUsuarioDesdeSesion(user: AuthenticatedUser): number {
    const idUsuario = Number(user.userId);
    if (!Number.isInteger(idUsuario) || idUsuario < 1) {
      throw new ForbiddenException('Acceso denegado');
    }
    return idUsuario;
  }
}
