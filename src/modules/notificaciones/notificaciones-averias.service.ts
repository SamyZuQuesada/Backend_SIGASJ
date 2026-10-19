import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { TipoEventoAveria } from '../../common/enums/tipo-evento-averia.enum';
import { TipoNotificacionAveria } from '../../common/enums/tipo-notificacion-averia.enum';
import { TipoSolicitudAusencia } from '../../common/enums/tipo-solicitud-ausencia.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Averia } from '../averias/entities/averia.entity';
import {
  etiquetaPrioridad,
  etiquetaTipoAveria,
  registrarEventoHistorialEnManager,
} from '../averias/historial-averias.registro';
import { SolicitudAusencia } from '../solicitudes-ausencia/entities/solicitud-ausencia.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { NotificacionAveria } from './entities/notificacion-averia.entity';

export type NotificacionAveriaItem = {
  id: number;
  idAveria: number | null;
  idSolicitudAusencia: number | null;
  tipo: TipoNotificacionAveria;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: Date;
  fechaLectura: Date | null;
};

export type NotificacionesAveriaListado = {
  data: NotificacionAveriaItem[];
  noLeidas: number;
};

export const NOTIFICACION_AJENA =
  'No puede consultar ni modificar notificaciones de otro usuario.';
export const NOTIFICACION_NO_ENCONTRADA = 'No se encontró la notificación.';

const toItem = (row: NotificacionAveria): NotificacionAveriaItem => ({
  id: row.id,
  idAveria: row.idAveria ?? null,
  idSolicitudAusencia: row.idSolicitudAusencia ?? null,
  tipo: row.tipo,
  titulo: row.titulo,
  mensaje: row.mensaje,
  leida: Boolean(row.leida),
  fechaCreacion: row.fechaCreacion,
  fechaLectura: row.fechaLectura,
});

function resolveDestinatarioId(user: AuthenticatedUser): number {
  const raw = user.idUsuario ?? user.userId;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ForbiddenException(NOTIFICACION_AJENA);
  }
  return id;
}

type RegistrarNotificacionInput = {
  idUsuarioDestinatario: number;
  idAveria?: number | null;
  idSolicitudAusencia?: number | null;
  tipo: TipoNotificacionAveria;
  titulo: string;
  mensaje: string;
};

@Injectable()
export class NotificacionesAveriasService {
  private readonly logger = new Logger(NotificacionesAveriasService.name);

  constructor(
    @InjectRepository(NotificacionAveria)
    private readonly notificacionRepository: Repository<NotificacionAveria>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async registrarSiNoExiste(
    input: RegistrarNotificacionInput,
  ): Promise<NotificacionAveria | null> {
    const idAveria =
      input.idAveria != null && Number.isInteger(input.idAveria)
        ? input.idAveria
        : null;
    const idSolicitudAusencia =
      input.idSolicitudAusencia != null &&
      Number.isInteger(input.idSolicitudAusencia)
        ? input.idSolicitudAusencia
        : null;

    if (
      (idAveria == null && idSolicitudAusencia == null) ||
      (idAveria != null && idSolicitudAusencia != null)
    ) {
      this.logger.warn(
        'Notificación omitida: se requiere exactamente una referencia (avería o solicitud).',
      );
      return null;
    }

    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: input.idUsuarioDestinatario },
    });
    if (!usuario || !usuario.activo) {
      return null;
    }

    const where =
      idAveria != null
        ? {
            idUsuarioDestinatario: input.idUsuarioDestinatario,
            idAveria,
            tipo: input.tipo,
          }
        : {
            idUsuarioDestinatario: input.idUsuarioDestinatario,
            idSolicitudAusencia: idSolicitudAusencia!,
            tipo: input.tipo,
          };

    const existente = await this.notificacionRepository.findOne({ where });
    if (existente) {
      return existente;
    }

    const payload: RegistrarNotificacionInput = {
      ...input,
      idAveria,
      idSolicitudAusencia,
    };

    try {
      return await this.insertarNotificacion(payload);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return this.notificacionRepository.findOne({ where });
      }
      throw error;
    }
  }

  private managerTransaccional(): EntityManager | null {
    const manager = this.notificacionRepository.manager;
    if (
      !manager ||
      typeof manager.transaction !== 'function' ||
      !manager.connection ||
      typeof manager.connection.hasMetadata !== 'function'
    ) {
      return null;
    }
    return manager;
  }

  private async insertarNotificacion(
    input: RegistrarNotificacionInput,
  ): Promise<NotificacionAveria> {
    const data = {
      idUsuarioDestinatario: input.idUsuarioDestinatario,
      idAveria: input.idAveria ?? null,
      idSolicitudAusencia: input.idSolicitudAusencia ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje,
      leida: false,
      fechaLectura: null,
    };
    const manager = this.managerTransaccional();
    if (!manager) {
      return this.notificacionRepository.save(
        this.notificacionRepository.create(data),
      );
    }

    // Solo las notificaciones de avería escriben historial de avería.
    if (input.idAveria == null) {
      return this.notificacionRepository.save(
        this.notificacionRepository.create(data),
      );
    }

    return manager.transaction(async (tx) => {
      const saved = await tx.save(
        NotificacionAveria,
        tx.create(NotificacionAveria, data),
      );
      await registrarEventoHistorialEnManager(tx, {
        idAveria: input.idAveria!,
        tipoEvento: TipoEventoAveria.NOTIFICACION,
        descripcion: `Notificación interna registrada: ${input.titulo}. Resultado: registrada.`,
        referenciaTipo: 'NotificacionAveria',
        referenciaId: saved.id,
      });
      return saved;
    });
  }

  async notificarAdministradorasNuevaAveria(averia: Averia): Promise<void> {
    const administradoras = await this.usuarioRepository.find({
      where: { activo: true, rol: { nombre: Role.ADMINISTRADORA } },
      relations: { rol: true },
    });

    const codigo = averia.codigoSeguimiento;
    for (const admin of administradoras) {
      await this.registrarSiNoExiste({
        idUsuarioDestinatario: admin.idUsuario,
        idAveria: averia.id,
        tipo: TipoNotificacionAveria.AVERIA_REGISTRADA_ADMINISTRADORA,
        titulo: `Nueva avería ${codigo}`,
        mensaje: `Se registró la avería ${codigo}.`,
      });
    }
  }

  async notificarFontaneroAsignacion(averia: Averia): Promise<void> {
    if (averia.idFontaneroAsignado == null) {
      return;
    }
    const codigo = averia.codigoSeguimiento;
    await this.registrarSiNoExiste({
      idUsuarioDestinatario: averia.idFontaneroAsignado,
      idAveria: averia.id,
      tipo: TipoNotificacionAveria.AVERIA_ASIGNADA_FONTANERO,
      titulo: `Avería asignada ${codigo}`,
      mensaje: `Se le asignó la avería ${codigo}.`,
    });
  }

  /**
   * Campana a Administradoras cuando el Fontanero ya calificó prioridad y tipo.
   */
  async notificarAdministradorasAveriaClasificada(
    averia: Averia,
  ): Promise<void> {
    if (!averia.prioridad?.trim() || !averia.tipoAveria?.trim()) {
      return;
    }

    const administradoras = await this.usuarioRepository.find({
      where: { activo: true, rol: { nombre: Role.ADMINISTRADORA } },
      relations: { rol: true },
    });

    const codigo = averia.codigoSeguimiento;
    const prioridad = etiquetaPrioridad(averia.prioridad);
    const tipo = etiquetaTipoAveria(averia.tipoAveria);
    for (const admin of administradoras) {
      await this.registrarSiNoExiste({
        idUsuarioDestinatario: admin.idUsuario,
        idAveria: averia.id,
        tipo: TipoNotificacionAveria.AVERIA_CLASIFICADA_ADMINISTRADORA,
        titulo: `Avería clasificada ${codigo}`,
        mensaje: `El fontanero calificó ${codigo}: prioridad ${prioridad}, tipo ${tipo}.`,
      });
    }
  }

  async notificarAdministradorasSolicitudAusenciaPendiente(
    solicitud: SolicitudAusencia,
  ): Promise<void> {
    const administradoras = await this.usuarioRepository.find({
      where: { activo: true, rol: { nombre: Role.ADMINISTRADORA } },
      relations: { rol: true },
    });

    const tipoEtiqueta =
      solicitud.tipo === TipoSolicitudAusencia.VACACIONES
        ? 'vacaciones'
        : 'permiso';
    const colaboradorNombre = nombreColaborador(solicitud);
    const periodo = `${solicitud.fechaInicio} – ${solicitud.fechaFin}`;
    const titulo = `Solicitud de ${tipoEtiqueta} pendiente`;
    const mensaje = colaboradorNombre
      ? `${colaboradorNombre} solicitó ${tipoEtiqueta} (${periodo}).`
      : `Nueva solicitud de ${tipoEtiqueta} (${periodo}).`;

    for (const admin of administradoras) {
      await this.registrarSiNoExiste({
        idUsuarioDestinatario: admin.idUsuario,
        idSolicitudAusencia: solicitud.id,
        tipo: TipoNotificacionAveria.SOLICITUD_AUSENCIA_PENDIENTE_ADMINISTRADORA,
        titulo,
        mensaje,
      });
    }
  }

  async listarPropias(
    user: AuthenticatedUser,
  ): Promise<NotificacionesAveriaListado> {
    const idUsuario = resolveDestinatarioId(user);
    const data = await this.notificacionRepository.find({
      where: { idUsuarioDestinatario: idUsuario },
      order: { fechaCreacion: 'DESC', id: 'DESC' },
      take: 50,
    });
    const noLeidas = data.filter((row) => !row.leida).length;
    return { data: data.map(toItem), noLeidas };
  }

  async marcarLeida(
    id: number,
    user: AuthenticatedUser,
  ): Promise<NotificacionAveriaItem> {
    const idUsuario = resolveDestinatarioId(user);
    const row = await this.notificacionRepository.findOne({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(NOTIFICACION_NO_ENCONTRADA);
    }
    if (row.idUsuarioDestinatario !== idUsuario) {
      throw new ForbiddenException(NOTIFICACION_AJENA);
    }
    if (!row.leida) {
      row.leida = true;
      row.fechaLectura = new Date();
      await this.notificacionRepository.save(row);
    }
    return toItem(row);
  }
}

function nombreColaborador(solicitud: SolicitudAusencia): string | null {
  const c = solicitud.colaborador;
  if (!c) {
    return null;
  }
  const nombre = [c.nombre, c.apellidos]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' ');
  return nombre || null;
}

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driver = error.driverError as { number?: number; code?: string };
  return (
    driver?.number === 2627 ||
    driver?.number === 2601 ||
    driver?.code === 'SQLITE_CONSTRAINT' ||
    String(error.message).toLowerCase().includes('unique')
  );
}
