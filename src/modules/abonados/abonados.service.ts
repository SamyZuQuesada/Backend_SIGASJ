import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SolicitudServicio } from '../solicitudes/entities/solicitud-servicio.entity';
import { Servicio } from '../servicios/entities/servicio.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CreateAbonadoResponseDto } from './dto/create-abonado-response.dto';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { Abonado } from './entities/abonado.entity';

@Injectable()
export class AbonadosService {
  private readonly logger = new Logger(AbonadosService.name);

  constructor(
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Servicio)
    private readonly servicioRepository: Repository<Servicio>,
    @InjectRepository(SolicitudServicio)
    private readonly solicitudRepository: Repository<SolicitudServicio>,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: CreateAbonadoDto): Promise<CreateAbonadoResponseDto> {
    await this.assertNoDuplicados(dto);

    if (dto.idSolicitud !== undefined) {
      await this.assertSolicitudDisponible(dto.idSolicitud);
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.idSolicitud !== undefined) {
        await this.assertSolicitudDisponible(dto.idSolicitud, manager);
      }

      const usuario = await manager.save(manager.create(Usuario, {}));
      const abonado = await manager.save(
        manager.create(Abonado, {
          idUsuario: usuario.idUsuario,
          nombre: dto.nombre.trim(),
          apellidos: dto.apellidos.trim(),
          cedula: dto.cedula.trim(),
          telefono: dto.telefono.trim(),
          correo: dto.correo.trim(),
          direccion: dto.direccion.trim(),
        }),
      );

      await manager.save(
        manager.create(Servicio, {
          idAbonado: abonado.idAbonado,
          nis: dto.servicio.nis.trim(),
          medidor: dto.servicio.medidor.trim(),
          sector: dto.servicio.sector.trim(),
          tarifa: dto.servicio.tarifa.trim(),
          numeroPlano: dto.servicio.numeroPlano.trim(),
        }),
      );

      if (dto.idSolicitud !== undefined) {
        const solicitud = await manager.findOne(SolicitudServicio, {
          where: { idSolicitud: dto.idSolicitud },
        });

        if (
          !solicitud ||
          solicitud.estado !== SolicitudEstado.APROBADA ||
          solicitud.utilizada
        ) {
          throw new BadRequestException(
            'La solicitud seleccionada no está disponible para registro.',
          );
        }

        solicitud.utilizada = true;
        solicitud.idAbonadoRegistrado = abonado.idAbonado;
        await manager.save(solicitud);
      }

      return {
        idAbonado: abonado.idAbonado,
        mensaje: 'Abonado y servicio registrados correctamente.',
      };
    });
  }

  async findOwn(user: AuthenticatedUser): Promise<Abonado> {
    return this.requireOwnAbonado(user);
  }

  async findOneForRequester(
    idAbonado: number,
    user: AuthenticatedUser,
  ): Promise<Abonado> {
    if (user.role === Role.ADMINISTRADORA || user.role === Role.SECRETARIA) {
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

  private async assertNoDuplicados(dto: CreateAbonadoDto): Promise<void> {
    const cedula = dto.cedula.trim();
    const nis = dto.servicio.nis.trim();
    const medidor = dto.servicio.medidor.trim();

    const [cedulaExistente, nisExistente, medidorExistente] = await Promise.all([
      this.abonadoRepository.exists({ where: { cedula } }),
      this.servicioRepository.exists({ where: { nis } }),
      this.servicioRepository.exists({ where: { medidor } }),
    ]);

    if (cedulaExistente) {
      throw new ConflictException(
        'Ya existe un abonado registrado con esa cédula.',
      );
    }
    if (nisExistente) {
      throw new ConflictException('Ya existe un servicio con ese NIS.');
    }
    if (medidorExistente) {
      throw new ConflictException(
        'Ya existe un servicio con ese número de medidor.',
      );
    }
  }

  private async assertSolicitudDisponible(
    idSolicitud: number,
    manager?: EntityManager,
  ): Promise<SolicitudServicio> {
    const repository = manager
      ? manager.getRepository(SolicitudServicio)
      : this.solicitudRepository;

    const solicitud = await repository.findOne({ where: { idSolicitud } });

    if (!solicitud) {
      throw new BadRequestException('La solicitud indicada no existe.');
    }

    if (solicitud.estado !== SolicitudEstado.APROBADA) {
      throw new BadRequestException(
        'La solicitud indicada no está aprobada para registro.',
      );
    }

    if (solicitud.utilizada) {
      throw new ConflictException(
        'La solicitud indicada ya fue utilizada para registrar un abonado.',
      );
    }

    return solicitud;
  }

  private idUsuarioDesdeSesion(user: AuthenticatedUser): number {
    const idUsuario = Number(user.userId);
    if (!Number.isInteger(idUsuario) || idUsuario < 1) {
      throw new ForbiddenException('Acceso denegado');
    }
    return idUsuario;
  }
}
