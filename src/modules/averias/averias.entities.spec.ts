import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

function averiaMinima(overrides: Partial<Averia> = {}): Averia {
  const averia = new Averia();
  averia.codigoSeguimiento = 'AVR-SQLJS-0001';
  averia.nombreReportante = 'María Pérez';
  averia.telefonoReportante = '2680-1234';
  averia.ubicacion = '200 m este de la escuela, casa azul';
  averia.sectorComunidad = 'San Juan';
  averia.descripcion = 'Fuga visible en tubería de distribución';
  Object.assign(averia, overrides);
  return averia;
}

describe('Persistencia Averia (sqljs / repository)', () => {
  jest.setTimeout(30_000);
  let dataSource: DataSource;
  let averias: Repository<Averia>;
  let observaciones: Repository<ObservacionAveria>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [Averia, ObservacionAveria, Usuario, Rol],
      synchronize: true,
    });
    await dataSource.initialize();
    averias = dataSource.getRepository(Averia);
    observaciones = dataSource.getRepository(ObservacionAveria);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await observaciones.clear();
    await averias.clear();
    await usuarios.clear();
  });

  it('persiste un registro mínimo en estado Recibida sin datos administrativos', async () => {
    const saved = await averias.save(
      averiaMinima({
        identificacionReportante: null,
        correoReportante: null,
        idAbonado: null,
        tipoAveria: null,
        prioridad: null,
        fontaneroAsignado: null,
        idFontaneroAsignado: null,
        fechaAsignacion: null,
        fechaInicioAtencion: null,
        fechaResolucion: null,
        observacionesAtencion: null,
      }),
    );

    expect(saved.id).toBeGreaterThan(0);
    expect(saved.codigoSeguimiento).toBe('AVR-SQLJS-0001');
    expect(saved.nombreReportante).toBe('María Pérez');
    expect(saved.telefonoReportante).toBe('2680-1234');
    expect(saved.ubicacion).toContain('escuela');
    expect(saved.sectorComunidad).toBe('San Juan');
    expect(saved.descripcion).toContain('Fuga');
    expect(saved.estado).toBe(EstadoAveria.RECIBIDA);
    expect(saved.fechaReporte).toBeInstanceOf(Date);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(saved.idAbonado).toBeNull();
    expect(saved.tipoAveria).toBeNull();
    expect(saved.prioridad).toBeNull();
    expect(saved.idFontaneroAsignado).toBeNull();
    expect(saved.fechaAsignacion).toBeNull();
    expect(saved.fechaInicioAtencion).toBeNull();
    expect(saved.fechaResolucion).toBeNull();
    expect(saved.observacionesAtencion).toBeNull();
  });

  it('persiste un Reportante que no es Abonado (idAbonado nulo)', async () => {
    const saved = await averias.save(
      averiaMinima({
        codigoSeguimiento: 'AVR-SQLJS-NOABO',
        idAbonado: null,
      }),
    );

    const loaded = await averias.findOneBy({ id: saved.id });
    expect(loaded?.idAbonado).toBeNull();
    expect(loaded?.nombreReportante).toBe('María Pérez');
  });

  it('persiste idAbonado opcional y conserva los datos directos del Reportante', async () => {
    const saved = await averias.save(
      averiaMinima({
        codigoSeguimiento: 'AVR-SQLJS-ABO',
        idAbonado: 15,
        nombreReportante: 'Luis Abonado',
        telefonoReportante: '8999-0000',
      }),
    );

    const loaded = await averias.findOneBy({ id: saved.id });
    expect(loaded?.idAbonado).toBe(15);
    expect(loaded?.nombreReportante).toBe('Luis Abonado');
    expect(loaded?.telefonoReportante).toBe('8999-0000');
  });

  it('acepta identificacionReportante y correoReportante nulos', async () => {
    const saved = await averias.save(
      averiaMinima({
        codigoSeguimiento: 'AVR-SQLJS-NULLS',
        identificacionReportante: null,
        correoReportante: null,
      }),
    );

    expect(saved.identificacionReportante).toBeNull();
    expect(saved.correoReportante).toBeNull();
  });

  it('rechaza telefonoReportante nulo a nivel de esquema', async () => {
    const metadata = dataSource.getMetadata(Averia);
    const telefono = metadata.findColumnWithPropertyName('telefonoReportante');
    expect(telefono?.isNullable).toBe(false);

    const averia = averiaMinima({ codigoSeguimiento: 'AVR-SQLJS-NOTEL' });
    (averia as { telefonoReportante: string | null }).telefonoReportante = null;

    await expect(averias.save(averia)).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('aplica el estado inicial RECIBIDA cuando no se especifica otro', async () => {
    const averia = averiaMinima({ codigoSeguimiento: 'AVR-SQLJS-EST' });
    const saved = await averias.save(averia);
    expect(saved.estado).toBe(EstadoAveria.RECIBIDA);
  });

  it('permite asignar un Fontanero (Usuario) después del alta', async () => {
    const inicial = await averias.save(
      averiaMinima({
        codigoSeguimiento: 'AVR-SQLJS-ASIG',
        idFontaneroAsignado: null,
      }),
    );
    expect(inicial.idFontaneroAsignado).toBeNull();

    const fontanero = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero persistido',
      correo: 'fontanero.entidad@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    inicial.idFontaneroAsignado = fontanero.idUsuario;
    inicial.fontaneroAsignado = fontanero;
    inicial.fechaAsignacion = new Date('2026-09-11T20:00:00Z');

    const actualizada = await averias.save(inicial);
    const loaded = await averias.findOne({
      where: { id: actualizada.id },
      relations: { fontaneroAsignado: true },
    });

    expect(loaded?.idFontaneroAsignado).toBe(fontanero.idUsuario);
    expect(loaded?.fontaneroAsignado?.idUsuario).toBe(fontanero.idUsuario);
    expect(loaded?.fechaAsignacion).toBeInstanceOf(Date);
  });

  it('rechaza un codigoSeguimiento duplicado por constraint UNIQUE', async () => {
    await averias.save(averiaMinima({ codigoSeguimiento: 'AVR-DUP-001' }));

    await expect(
      averias.save(averiaMinima({ codigoSeguimiento: 'AVR-DUP-001' })),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('establece createdAt al insertar y actualiza updatedAt al modificar', async () => {
    const saved = await averias.save(
      averiaMinima({ codigoSeguimiento: 'AVR-SQLJS-AUDIT' }),
    );
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    const createdAt = saved.createdAt.getTime();
    const updatedAtInicial = saved.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 25));
    saved.descripcion = 'Fuga confirmada en acometida';
    const updated = await averias.save(saved);

    expect(updated.createdAt.getTime()).toBe(createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      updatedAtInicial,
    );
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      updated.createdAt.getTime(),
    );
  });

  it('no usa cascade al persistir Averia (no crea Usuario automáticamente)', () => {
    const relation = dataSource
      .getMetadata(Averia)
      .findRelationWithPropertyPath('fontaneroAsignado');
    expect(relation?.isCascadeInsert).toBe(false);
    expect(relation?.isCascadeUpdate).toBe(false);
    expect(relation?.onDelete).toBe('SET NULL');
  });

  it('persiste observaciones independientes sin sobrescribir Averia.observacionesAtencion', async () => {
    const fontanero = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero observaciones',
      correo: 'fontanero.obs@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    const averia = await averias.save(
      averiaMinima({
        codigoSeguimiento: 'AVR-SQLJS-OBS',
        observacionesAtencion: 'Texto legado',
        idFontaneroAsignado: fontanero.idUsuario,
      }),
    );

    const primera = await observaciones.save(
      observaciones.create({
        observacion: 'Primera nota de campo',
        idAveria: averia.id,
        idUsuarioAutor: fontanero.idUsuario,
      }),
    );
    const segunda = await observaciones.save(
      observaciones.create({
        observacion: 'Segunda nota de campo',
        idAveria: averia.id,
        idUsuarioAutor: fontanero.idUsuario,
      }),
    );

    expect(primera.id).not.toBe(segunda.id);
    expect(primera.fechaCreacion).toBeInstanceOf(Date);
    expect(segunda.fechaCreacion).toBeInstanceOf(Date);

    const rows = await observaciones.find({
      where: { idAveria: averia.id },
      order: { id: 'ASC' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.observacion).toBe('Primera nota de campo');
    expect(rows[1]?.observacion).toBe('Segunda nota de campo');

    const loaded = await averias.findOneBy({ id: averia.id });
    expect(loaded?.observacionesAtencion).toBe('Texto legado');
  });

  it('no usa cascade al persistir ObservacionAveria', () => {
    const metadata = dataSource.getMetadata(ObservacionAveria);
    const averiaRel = metadata.findRelationWithPropertyPath('averia');
    const autorRel = metadata.findRelationWithPropertyPath('autor');
    expect(averiaRel?.isCascadeInsert).toBe(false);
    expect(averiaRel?.isCascadeUpdate).toBe(false);
    expect(averiaRel?.onDelete).toBe('NO ACTION');
    expect(autorRel?.isCascadeInsert).toBe(false);
    expect(autorRel?.onDelete).toBe('NO ACTION');
  });
});
