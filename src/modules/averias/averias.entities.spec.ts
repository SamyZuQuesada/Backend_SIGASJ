import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Averia } from './entities/averia.entity';

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
  let usuarios: Repository<Usuario>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [Averia, Usuario],
      synchronize: true,
    });
    await dataSource.initialize();
    averias = dataSource.getRepository(Averia);
    usuarios = dataSource.getRepository(Usuario);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
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

    const fontanero = await usuarios.save(new Usuario());
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
});
