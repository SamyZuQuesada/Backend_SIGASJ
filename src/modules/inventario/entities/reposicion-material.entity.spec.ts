import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import {
  EstadoReposicionMaterial,
  ESTADO_REPOSICION_MATERIAL_LABELS,
  isEstadoReposicionMaterialValido,
} from '../../../common/enums/estado-reposicion-material.enum';
import {
  OrigenReposicionMaterial,
  ORIGEN_REPOSICION_MATERIAL_LABELS,
  isOrigenReposicionMaterialValido,
} from '../../../common/enums/origen-reposicion-material.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { AlertaReposicion } from './alerta-reposicion.entity';
import { DetalleReposicionMaterial } from './detalle-reposicion-material.entity';
import { Material } from './material.entity';
import { Proveedor } from './proveedor.entity';
import { ReposicionMaterial } from './reposicion-material.entity';
import { SolicitudMaterial } from './solicitud-material.entity';

describe('ReposicionMaterial Entity (Inventario ASADA)', () => {
  describe('Enum OrigenReposicionMaterial', () => {
    it('debe definir los orígenes de alerta, solicitud y gestión administrativa', () => {
      expect(OrigenReposicionMaterial.ALERTA_STOCK_MINIMO).toBe(
        'ALERTA_STOCK_MINIMO',
      );
      expect(OrigenReposicionMaterial.SOLICITUD_APROBADA).toBe(
        'SOLICITUD_APROBADA',
      );
      expect(OrigenReposicionMaterial.ADMINISTRATIVA).toBe('ADMINISTRATIVA');
    });

    it('debe exponer etiquetas y validar orígenes', () => {
      expect(
        ORIGEN_REPOSICION_MATERIAL_LABELS[
          OrigenReposicionMaterial.ALERTA_STOCK_MINIMO
        ],
      ).toBe('Alerta de stock mínimo');
      expect(isOrigenReposicionMaterialValido('ALERTA_STOCK_MINIMO')).toBe(true);
      expect(isOrigenReposicionMaterialValido('OTRO')).toBe(false);
    });
  });

  describe('Enum EstadoReposicionMaterial', () => {
    it('debe definir el flujo desde pendiente hasta completada', () => {
      expect(EstadoReposicionMaterial.PENDIENTE).toBe('PENDIENTE');
      expect(EstadoReposicionMaterial.EN_GESTION).toBe('EN_GESTION');
      expect(EstadoReposicionMaterial.COMPRA_REGISTRADA).toBe(
        'COMPRA_REGISTRADA',
      );
      expect(EstadoReposicionMaterial.PENDIENTE_RECEPCION).toBe(
        'PENDIENTE_RECEPCION',
      );
      expect(EstadoReposicionMaterial.RECIBIDA).toBe('RECIBIDA');
      expect(EstadoReposicionMaterial.COMPLETADA).toBe('COMPLETADA');
    });

    it('debe exponer etiquetas y validar estados', () => {
      expect(
        ESTADO_REPOSICION_MATERIAL_LABELS[
          EstadoReposicionMaterial.PENDIENTE_RECEPCION
        ],
      ).toBe('Pendiente de recepción');
      expect(isEstadoReposicionMaterialValido('PENDIENTE')).toBe(true);
      expect(isEstadoReposicionMaterialValido('CANCELADA')).toBe(false);
    });
  });

  describe('Instanciación y atributos', () => {
    it('debe permitir una reposición originada en alerta, con materiales y cantidad', () => {
      const alerta = new AlertaReposicion();
      alerta.id = 3;
      const material = new Material();
      material.id = 4;
      material.nombre = 'Tubo PVC 1/2"';
      material.unidadMedida = 'Metro';
      const responsable = new Usuario();
      responsable.idUsuario = 2;

      const reposicion = new ReposicionMaterial();
      const fecha = new Date('2026-08-22T08:00:00Z');
      reposicion.id = 12;
      reposicion.codigo = 'REP-0012';
      reposicion.fechaGeneracion = fecha;
      reposicion.origen = OrigenReposicionMaterial.ALERTA_STOCK_MINIMO;
      reposicion.estado = EstadoReposicionMaterial.PENDIENTE;
      reposicion.idAlertaReposicion = 3;
      reposicion.alertaReposicion = alerta;
      reposicion.idSolicitudMaterial = null;
      reposicion.solicitudMaterial = null;
      reposicion.idUsuarioResponsable = 2;
      reposicion.usuarioResponsable = responsable;
      reposicion.idProveedor = null;
      reposicion.proveedor = null;
      reposicion.fechaCompra = null;
      reposicion.fechaRecepcion = null;
      reposicion.observacion = 'Reposición por stock mínimo';

      const detalle = new DetalleReposicionMaterial();
      detalle.id = 1;
      detalle.idReposicion = 12;
      detalle.reposicion = reposicion;
      detalle.idMaterial = 4;
      detalle.material = material;
      detalle.cantidad = 30;
      reposicion.detalles = [detalle];

      expect(reposicion.codigo).toBe('REP-0012');
      expect(reposicion.origen).toBe(
        OrigenReposicionMaterial.ALERTA_STOCK_MINIMO,
      );
      expect(reposicion.alertaReposicion?.id).toBe(3);
      expect(reposicion.detalles[0].cantidad).toBe(30);
      expect(reposicion.detalles[0].material.nombre).toBe('Tubo PVC 1/2"');
      expect(reposicion.usuarioResponsable.idUsuario).toBe(2);
      expect(
        (reposicion as unknown as { nombreMaterial?: string }).nombreMaterial,
      ).toBeUndefined();
    });

    it('debe permitir originarse en una solicitud aprobada y preparar la compra', () => {
      const solicitud = new SolicitudMaterial();
      solicitud.id = 8;
      const proveedor = new Proveedor();
      proveedor.id = 5;
      proveedor.nombre = 'Ferretería ABC';

      const reposicion = new ReposicionMaterial();
      reposicion.origen = OrigenReposicionMaterial.SOLICITUD_APROBADA;
      reposicion.estado = EstadoReposicionMaterial.COMPRA_REGISTRADA;
      reposicion.idSolicitudMaterial = 8;
      reposicion.solicitudMaterial = solicitud;
      reposicion.idProveedor = 5;
      reposicion.proveedor = proveedor;
      reposicion.fechaCompra = new Date('2026-08-25T10:00:00Z');

      expect(reposicion.solicitudMaterial?.id).toBe(8);
      expect(reposicion.proveedor?.nombre).toBe('Ferretería ABC');
      expect(reposicion.fechaCompra).toBeInstanceOf(Date);
    });
  });

  describe('Validaciones y hooks', () => {
    it('asigna fecha, estado PENDIENTE y nulos opcionales en BeforeInsert', () => {
      const reposicion = new ReposicionMaterial();
      reposicion.origen = OrigenReposicionMaterial.ADMINISTRATIVA;
      reposicion.idUsuarioResponsable = 2;
      reposicion.asignarValoresIniciales();

      expect(reposicion.fechaGeneracion).toBeInstanceOf(Date);
      expect(reposicion.estado).toBe(EstadoReposicionMaterial.PENDIENTE);
      expect(reposicion.codigo).toBeNull();
      expect(reposicion.idAlertaReposicion).toBeNull();
      expect(reposicion.idSolicitudMaterial).toBeNull();
      expect(reposicion.idProveedor).toBeNull();
    });

    it('rechaza estado y origen inválidos', () => {
      const reposicion = new ReposicionMaterial();
      reposicion.origen = OrigenReposicionMaterial.ADMINISTRATIVA;
      reposicion.estado = 'ATENDIDA' as unknown as EstadoReposicionMaterial;
      expect(() => reposicion.validar()).toThrow(BadRequestException);

      reposicion.estado = EstadoReposicionMaterial.PENDIENTE;
      reposicion.origen = 'OTRO' as unknown as OrigenReposicionMaterial;
      expect(() => reposicion.validar()).toThrow('Origen de reposición no válido');
    });

    it('exige cantidad entera mayor a cero en el detalle', () => {
      const detalle = new DetalleReposicionMaterial();
      detalle.cantidad = 0;
      expect(() => detalle.validar()).toThrow(
        'La cantidad de reposición debe ser mayor a cero',
      );
      detalle.cantidad = 1.5;
      expect(() => detalle.validar()).toThrow(BadRequestException);
      detalle.cantidad = 10;
      expect(() => detalle.validar()).not.toThrow();
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('registra ReposicionMaterial y DetalleReposicionMaterial', () => {
      expect(
        storage.tables.find((t) => t.name === 'ReposicionMaterial'),
      ).toBeDefined();
      expect(
        storage.tables.find((t) => t.name === 'DetalleReposicionMaterial'),
      ).toBeDefined();
    });

    it('tiene llave primaria autoincremental y columnas de trazabilidad', () => {
      const columns = storage.columns
        .filter((c) => c.target === ReposicionMaterial)
        .map((c) => c.propertyName);

      expect(columns).toEqual(
        expect.arrayContaining([
          'id',
          'codigo',
          'fechaGeneracion',
          'origen',
          'estado',
          'idAlertaReposicion',
          'idSolicitudMaterial',
          'idUsuarioResponsable',
          'idProveedor',
          'fechaCompra',
          'fechaRecepcion',
          'observacion',
          'createdAt',
          'updatedAt',
        ]),
      );
      expect(columns).not.toContain('nombre');
      expect(columns).not.toContain('unidadMedida');

      const generated = storage.generations.find(
        (g) => g.target === ReposicionMaterial && g.propertyName === 'id',
      );
      expect(generated?.strategy).toBe('increment');
    });

    it('relaciona alerta y solicitud de forma opcional', () => {
      const alerta = storage.relations.find(
        (r) =>
          r.target === ReposicionMaterial && r.propertyName === 'alertaReposicion',
      );
      const solicitud = storage.relations.find(
        (r) =>
          r.target === ReposicionMaterial &&
          r.propertyName === 'solicitudMaterial',
      );
      expect(alerta?.options.nullable).toBe(true);
      expect(solicitud?.options.nullable).toBe(true);
    });

    it('relaciona el usuario responsable de forma obligatoria y el proveedor de forma opcional', () => {
      const responsable = storage.relations.find(
        (r) =>
          r.target === ReposicionMaterial &&
          r.propertyName === 'usuarioResponsable',
      );
      const proveedor = storage.relations.find(
        (r) => r.target === ReposicionMaterial && r.propertyName === 'proveedor',
      );
      expect(responsable?.options.nullable).toBe(false);
      expect(proveedor?.options.nullable).toBe(true);

      const joinResponsable = storage.joinColumns.find(
        (j) =>
          j.target === ReposicionMaterial &&
          j.propertyName === 'usuarioResponsable',
      );
      expect(joinResponsable?.referencedColumnName).toBe('idUsuario');
    });

    it('relaciona detalles 1:N con material y cantidad', () => {
      const detalles = storage.relations.find(
        (r) => r.target === ReposicionMaterial && r.propertyName === 'detalles',
      );
      expect(detalles?.relationType).toBe('one-to-many');

      const material = storage.relations.find(
        (r) =>
          r.target === DetalleReposicionMaterial && r.propertyName === 'material',
      );
      expect(material?.options.nullable).toBe(false);

      const cantidad = storage.columns.find(
        (c) =>
          c.target === DetalleReposicionMaterial && c.propertyName === 'cantidad',
      );
      expect(cantidad).toBeDefined();
    });
  });
});
