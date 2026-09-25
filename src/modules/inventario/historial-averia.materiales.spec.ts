import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoEventoAveria } from '../../common/enums/tipo-evento-averia.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Averia } from '../averias/entities/averia.entity';
import { HistorialAveria } from '../averias/entities/historial-averia.entity';
import { ObservacionAveria } from '../averias/entities/observacion-averia.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { AlertaReposicion } from './entities/alerta-reposicion.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DetalleReposicionMaterial } from './entities/detalle-reposicion-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { ReposicionMaterial } from './entities/reposicion-material.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { InventarioModule } from './inventario.module';
import { InventarioService } from './inventario.service';

describe('Trazabilidad de materiales ligados a una avería', () => {
  jest.setTimeout(30_000);

  it('registra la solicitud y la salida sin copiar el inventario completo', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          synchronize: true,
          entities: [
            Usuario,
            Rol,
            Material,
            CategoriaMaterial,
            Proveedor,
            MovimientoInventario,
            DocumentoMovimientoInventario,
            Averia,
            ObservacionAveria,
            HistorialAveria,
            SolicitudMaterial,
            DetalleSolicitudMaterial,
            AlertaReposicion,
            ReposicionMaterial,
            DetalleReposicionMaterial,
          ],
        }),
        InventarioModule,
      ],
    }).compile();

    const dataSource = moduleRef.get(DataSource);
    const inventario = moduleRef.get(InventarioService);
    const roles = await seedRolesBase(dataSource.getRepository(Rol));
    const fontanero = await crearUsuarioPrueba(
      dataSource.getRepository(Usuario),
      roles,
      {
        nombre: 'Fontanero Materiales',
        correo: 'fontanero.materiales@asadasanjuan.cr',
        role: Role.FONTANERO,
      },
    );
    const material = await dataSource.getRepository(Material).save(
      dataSource.getRepository(Material).create({
        nombre: 'Tubo PVC',
        unidadMedida: 'Metro',
        stockActual: 20,
        stockMinimo: 0,
        activo: true,
      }),
    );
    const averia = await dataSource.getRepository(Averia).save(
      dataSource.getRepository(Averia).create({
        codigoSeguimiento: 'AV-MAT-0001',
        fechaReporte: new Date('2026-08-22T14:00:00.000Z'),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-1111',
        ubicacion: 'Escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga',
        estado: EstadoAveria.ASIGNADA,
        idFontaneroAsignado: fontanero.idUsuario,
      }),
    );
    const user: AuthenticatedUser = {
      userId: String(fontanero.idUsuario),
      idUsuario: fontanero.idUsuario,
      email: fontanero.correo,
      role: Role.FONTANERO,
      name: fontanero.nombre,
    };

    const solicitud = await inventario.registrarSolicitudMaterial(
      {
        materiales: [{ idMaterial: material.id, cantidad: 2 }],
        idAveria: averia.id,
      },
      user,
    );
    const salida = await inventario.registrarSalida(
      { idMaterial: material.id, cantidad: 2, idAveria: averia.id },
      user,
    );

    const eventos = await dataSource.getRepository(HistorialAveria).find({
      where: { idAveria: averia.id },
      order: { id: 'ASC' },
    });
    expect(eventos.map((evento) => evento.tipoEvento)).toEqual([
      TipoEventoAveria.SOLICITUD_MATERIAL,
      TipoEventoAveria.SALIDA_MATERIAL,
    ]);
    expect(eventos[0]?.referenciaTipo).toBe('SolicitudMaterial');
    expect(eventos[0]?.referenciaId).toBe(solicitud.id);
    expect(eventos[0]?.descripcion).toContain(solicitud.codigo);
    expect(eventos[0]?.idUsuario).toBe(fontanero.idUsuario);
    expect(eventos[1]?.referenciaTipo).toBe('MovimientoInventario');
    expect(eventos[1]?.referenciaId).toBe(salida.movimiento.id);
    expect(eventos[1]?.descripcion).toContain('Tubo PVC');
    expect(eventos[1]?.descripcion).not.toContain('stock');

    await moduleRef.close();
  });
});
