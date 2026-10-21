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
  idSolicitudMateriales: number | null;
  idSalidaInventario: number | null;
  idReposicion: number | null;
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
  idSolicitudMateriales: row.idSolicitudMateriales ?? null,
  idSalidaInventario: row.idSalidaInventario ?? null,
  idReposicion: row.idReposicion ?? null,
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

export type RegistrarNotificacionInput = {
  idUsuarioDestinatario: number;
  idAveria?: number | null;
  idSolicitudAusencia?: number | null;
  idSolicitudMateriales?: number | null;
  idSalidaInventario?: number | null;
  idReposicion?: number | null;
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
    manager?: EntityManager,
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
    const idSolicitudMateriales =
      input.idSolicitudMateriales != null &&
      Number.isInteger(input.idSolicitudMateriales)
        ? input.idSolicitudMateriales
        : null;
    const idSalidaInventario =
      input.idSalidaInventario != null &&
      Number.isInteger(input.idSalidaInventario)
        ? input.idSalidaInventario
        : null;
    const idReposicion =
      input.idReposicion != null && Number.isInteger(input.idReposicion)
        ? input.idReposicion
        : null;

    const refs = [
      idAveria,
      idSolicitudAusencia,
      idSolicitudMateriales,
      idSalidaInventario,
      idReposicion,
    ].filter((r) => r != null);

    if (refs.length !== 1) {
      this.logger.warn(
        'Notificación omitida: se requiere exactamente una referencia principal.',
      );
      return null;
    }

    const userRepo =
      manager && typeof manager.getRepository === 'function'
        ? manager.getRepository(Usuario)
        : this.usuarioRepository;
    const usuario = await userRepo.findOne({
      where: { idUsuario: input.idUsuarioDestinatario },
    });
    if (!usuario || !usuario.activo) {
      return null;
    }

    const where: Record<string, unknown> = {
      idUsuarioDestinatario: input.idUsuarioDestinatario,
      tipo: input.tipo,
    };
    if (idAveria != null) where.idAveria = idAveria;
    if (idSolicitudAusencia != null)
      where.idSolicitudAusencia = idSolicitudAusencia;
    if (idSolicitudMateriales != null)
      where.idSolicitudMateriales = idSolicitudMateriales;
    if (idSalidaInventario != null)
      where.idSalidaInventario = idSalidaInventario;
    if (idReposicion != null) where.idReposicion = idReposicion;

    const notifRepo =
      manager && typeof manager.getRepository === 'function'
        ? manager.getRepository(NotificacionAveria)
        : this.notificacionRepository;

    const existente = await notifRepo.findOne({ where: where as any });
    if (existente) {
      return existente;
    }

    const payload: RegistrarNotificacionInput = {
      ...input,
      idAveria,
      idSolicitudAusencia,
      idSolicitudMateriales,
      idSalidaInventario,
      idReposicion,
    };

    try {
      return await this.insertarNotificacion(payload, manager);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return notifRepo.findOne({ where: where as any });
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
    externalManager?: EntityManager,
  ): Promise<NotificacionAveria> {
    const data = {
      idUsuarioDestinatario: input.idUsuarioDestinatario,
      idAveria: input.idAveria ?? null,
      idSolicitudAusencia: input.idSolicitudAusencia ?? null,
      idSolicitudMateriales: input.idSolicitudMateriales ?? null,
      idSalidaInventario: input.idSalidaInventario ?? null,
      idReposicion: input.idReposicion ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje,
      leida: false,
      fechaLectura: null,
    };

    if (externalManager && typeof externalManager.getRepository === 'function') {
      const notifRepo = externalManager.getRepository(NotificacionAveria);
      const created = notifRepo.create(data);
      const saved = await notifRepo.save(created);
      if (input.idAveria != null) {
        await registrarEventoHistorialEnManager(externalManager, {
          idAveria: input.idAveria,
          tipoEvento: TipoEventoAveria.NOTIFICACION,
          descripcion: `Notificación interna registrada: ${input.titulo}. Resultado: registrada.`,
          referenciaTipo: 'NotificacionAveria',
          referenciaId: saved.id,
        });
      }
      return saved;
    }

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

  async notificarAdministradorasSolicitudMaterialesPendiente(
    solicitud: { id: number },
    fontanero?: { nombre?: string | null } | null,
    manager?: EntityManager,
  ): Promise<void> {
    const userRepo =
      manager && typeof manager.getRepository === 'function'
        ? manager.getRepository(Usuario)
        : this.usuarioRepository;
    const administradoras = await userRepo.find({
      where: { activo: true, rol: { nombre: Role.ADMINISTRADORA } },
      relations: { rol: true },
    });

    const nombre = fontanero?.nombre ? fontanero.nombre.trim() : '';
    const mensaje = nombre
      ? `El fontanero ${nombre} registró una solicitud de materiales.`
      : 'Un fontanero registró una solicitud de materiales.';

    for (const admin of administradoras) {
      await this.registrarSiNoExiste(
        {
          idUsuarioDestinatario: admin.idUsuario,
          idSolicitudMateriales: solicitud.id,
          tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_PENDIENTE_ADMINISTRADORA,
          titulo: 'Nueva solicitud de materiales',
          mensaje,
        },
        manager,
      );
    }
  }

  async notificarFontaneroSolicitudMaterialesAprobada(
    solicitud: { id: number; codigo?: string | null; idFontanero: number },
    manager?: EntityManager,
  ): Promise<void> {
    const codigo =
      solicitud.codigo?.trim() ||
      `SM-${String(solicitud.id).padStart(4, '0')}`;
    const titulo = 'Solicitud de materiales aprobada';
    const mensaje = `Su solicitud de materiales ${codigo} fue aprobada.`;

    await this.registrarSiNoExiste(
      {
        idUsuarioDestinatario: solicitud.idFontanero,
        idSolicitudMateriales: solicitud.id,
        tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_APROBADA_FONTANERO,
        titulo,
        mensaje,
      },
      manager,
    );
  }

  async notificarFontaneroSolicitudMaterialesRechazada(
    solicitud: { id: number; codigo?: string | null; idFontanero: number },
    motivoRechazo?: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    const codigo =
      solicitud.codigo?.trim() ||
      `SM-${String(solicitud.id).padStart(4, '0')}`;
    const titulo = 'Solicitud de materiales rechazada';
    const motivoTexto = motivoRechazo?.trim()
      ? ` Motivo: ${motivoRechazo.trim()}.`
      : '';
    const mensaje = `Su solicitud de materiales ${codigo} fue rechazada.${motivoTexto}`;

    await this.registrarSiNoExiste(
      {
        idUsuarioDestinatario: solicitud.idFontanero,
        idSolicitudMateriales: solicitud.id,
        tipo: TipoNotificacionAveria.SOLICITUD_MATERIALES_RECHAZADA_FONTANERO,
        titulo,
        mensaje,
      },
      manager,
    );
  }

  async notificarAdministradorasSalidaInventario(
    movimiento: { id: number },
    usuario?: { nombre?: string | null } | null,
    manager?: EntityManager,
  ): Promise<void> {
    const userRepo =
      manager && typeof manager.getRepository === 'function'
        ? manager.getRepository(Usuario)
        : this.usuarioRepository;
    const administradoras = await userRepo.find({
      where: { activo: true, rol: { nombre: Role.ADMINISTRADORA } },
      relations: { rol: true },
    });

    const nombre = usuario?.nombre ? usuario.nombre.trim() : '';
    const mensaje = nombre
      ? `El fontanero ${nombre} registró una salida de materiales.`
      : 'El fontanero registró una salida de materiales.';

    for (const admin of administradoras) {
      await this.registrarSiNoExiste(
        {
          idUsuarioDestinatario: admin.idUsuario,
          idSalidaInventario: movimiento.id,
          tipo: TipoNotificacionAveria.SALIDA_INVENTARIO_REGISTRADA_ADMINISTRADORA,
          titulo: 'Nueva salida de inventario',
          mensaje,
        },
        manager,
      );
    }
  }

  async notificarAdministradorasAlertaReposicion(
    alerta: { id: number },
    material: { nombre: string },
    manager?: EntityManager,
  ): Promise<void> {
    const userRepo =
      manager && typeof manager.getRepository === 'function'
        ? manager.getRepository(Usuario)
        : this.usuarioRepository;
    const administradoras = await userRepo.find({
      where: { activo: true, rol: { nombre: Role.ADMINISTRADORA } },
      relations: { rol: true },
    });

    const nombreMaterial = material.nombre ? material.nombre.trim() : '';
    const mensaje = `El material ${nombreMaterial} alcanzó el nivel mínimo de existencias.`;

    for (const admin of administradoras) {
      await this.registrarSiNoExiste(
        {
          idUsuarioDestinatario: admin.idUsuario,
          idReposicion: alerta.id,
          tipo: TipoNotificacionAveria.ALERTA_REPOSICION_ADMINISTRADORA,
          titulo: 'Alerta de reposición',
          mensaje,
        },
        manager,
      );
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
