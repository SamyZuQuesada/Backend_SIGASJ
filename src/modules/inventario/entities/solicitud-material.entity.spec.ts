import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import {
  EstadoSolicitudMaterial,
  ESTADO_SOLICITUD_MATERIAL_LABELS,
  isEstadoSolicitudMaterialValido,
} from '../../../common/enums/estado-solicitud-material.enum';
import { Averia } from '../../averias/entities/averia.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DetalleSolicitudMaterial } from './detalle-solicitud-material.entity';
import { Material } from './material.entity';
import { SolicitudMaterial } from './solicitud-material.entity';

describe('SolicitudMaterial Entity (Inventario ASADA)', () => {
  describe('Enum EstadoSolicitudMaterial', () => {
    it('debe definir los estados PENDIENTE, APROBADA y RECHAZADA', () => {
      expect(EstadoSolicitudMaterial.PENDIENTE).toBe('PENDIENTE');
      expect(EstadoSolicitudMaterial.APROBADA).toBe('APROBADA');
      expect(EstadoSolicitudMaterial.RECHAZADA).toBe('RECHAZADA');
    });

    it('debe contener las etiquetas descriptivas legibles', () => {
      expect(
        ESTADO_SOLICITUD_MATERIAL_LABELS[EstadoSolicitudMaterial.PENDIENTE],
      ).toBe('Pendiente');
      expect(
        ESTADO_SOLICITUD_MATERIAL_LABELS[EstadoSolicitudMaterial.APROBADA],
      ).toBe('Aprobada');
      expect(
        ESTADO_SOLICITUD_MATERIAL_LABELS[EstadoSolicitudMaterial.RECHAZADA],
      ).toBe('Rechazada');
    });

    it('debe validar estados correctamente con isEstadoSolicitudMaterialValido', () => {
      expect(isEstadoSolicitudMaterialValido('PENDIENTE')).toBe(true);
      expect(isEstadoSolicitudMaterialValido('APROBADA')).toBe(true);
      expect(isEstadoSolicitudMaterialValido('RECHAZADA')).toBe(true);
      expect(isEstadoSolicitudMaterialValido('CANCELADA')).toBe(false);
      expect(isEstadoSolicitudMaterialValido('')).toBe(false);
    });
  });

  describe('Instanciación y Atributos de SolicitudMaterial', () => {
    it('debe existir la clase SolicitudMaterial', () => {
      expect(SolicitudMaterial).toBeDefined();
    });

    it('debe permitir instanciar una solicitud completa vinculada a un Fontanero', () => {
      const fontanero = new Usuario();
      fontanero.idUsuario = 15;

      const solicitud = new SolicitudMaterial();
      const fecha = new Date('2026-08-22T08:30:00Z');

      solicitud.id = 8;
      solicitud.codigo = 'SOL-0008';
      solicitud.fechaSolicitud = fecha;
      solicitud.estado = EstadoSolicitudMaterial.PENDIENTE;
      solicitud.observacion =
        'Materiales requeridos para mantenimiento de tubería principal';
      solicitud.idFontanero = 15;
      solicitud.fontanero = fontanero;
      solicitud.idAveria = null;
      solicitud.averia = null;
      solicitud.createdAt = fecha;
      solicitud.updatedAt = fecha;

      expect(solicitud.id).toBe(8);
      expect(solicitud.codigo).toBe('SOL-0008');
      expect(solicitud.fechaSolicitud).toEqual(fecha);
      expect(solicitud.estado).toBe(EstadoSolicitudMaterial.PENDIENTE);
      expect(solicitud.observacion).toBe(
        'Materiales requeridos para mantenimiento de tubería principal',
      );
      expect(solicitud.idFontanero).toBe(15);
      expect(solicitud.fontanero).toBe(fontanero);
      expect(solicitud.idAveria).toBeNull();
      expect(solicitud.averia).toBeNull();
    });

    it('debe permitir relacionar opcionalmente una Avería cuando la solicitud provenga de Gestión de Averías', () => {
      const averia = new Averia();
      averia.id = 101;
      averia.codigoSeguimiento = 'AVR-2026-0001';

      const solicitud = new SolicitudMaterial();
      solicitud.id = 9;
      solicitud.codigo = 'SOL-0009';
      solicitud.idFontanero = 15;
      solicitud.idAveria = 101;
      solicitud.averia = averia;

      expect(solicitud.idAveria).toBe(101);
      expect(solicitud.averia).toBe(averia);
      expect(solicitud.averia.codigoSeguimiento).toBe('AVR-2026-0001');
    });

    it('debe soportar una solicitud independiente sin avería asignada', () => {
      const solicitud = new SolicitudMaterial();
      solicitud.idFontanero = 12;
      solicitud.idAveria = null;
      solicitud.averia = null;

      expect(solicitud.idAveria).toBeNull();
      expect(solicitud.averia).toBeNull();
    });

    it('debe preparar campos de trazabilidad para revisión y aprobación administrativa', () => {
      const administrador = new Usuario();
      administrador.idUsuario = 2;

      const solicitud = new SolicitudMaterial();
      const fechaRevision = new Date('2026-08-23T14:00:00Z');

      solicitud.id = 10;
      solicitud.estado = EstadoSolicitudMaterial.RECHAZADA;
      solicitud.idUsuarioAprobador = 2;
      solicitud.usuarioAprobador = administrador;
      solicitud.fechaRevision = fechaRevision;
      solicitud.motivoRechazo =
        'Cantidad solicitada excede la orden de trabajo';

      expect(solicitud.estado).toBe(EstadoSolicitudMaterial.RECHAZADA);
      expect(solicitud.idUsuarioAprobador).toBe(2);
      expect(solicitud.usuarioAprobador).toBe(administrador);
      expect(solicitud.fechaRevision).toEqual(fechaRevision);
      expect(solicitud.motivoRechazo).toBe(
        'Cantidad solicitada excede la orden de trabajo',
      );
    });
  });

  describe('Validaciones y Hooks de SolicitudMaterial (@BeforeInsert / @BeforeUpdate)', () => {
    it('debe asignar fechaSolicitud y estado PENDIENTE automáticamente en BeforeInsert si no fueron provistos', () => {
      const solicitud = new SolicitudMaterial();
      solicitud.asignarValoresIniciales();

      expect(solicitud.fechaSolicitud).toBeInstanceOf(Date);
      expect(solicitud.estado).toBe(EstadoSolicitudMaterial.PENDIENTE);
    });

    it('debe sanitizar cadenas con trim en código, observación y motivoRechazo', () => {
      const solicitud = new SolicitudMaterial();
      solicitud.estado = EstadoSolicitudMaterial.PENDIENTE;
      solicitud.codigo = '  SOL-0012  ';
      solicitud.observacion = '  Urgente para sector norte  ';
      solicitud.motivoRechazo = '   ';

      solicitud.validar();

      expect(solicitud.codigo).toBe('SOL-0012');
      expect(solicitud.observacion).toBe('Urgente para sector norte');
      expect(solicitud.motivoRechazo).toBeNull();
    });

    it('debe lanzar BadRequestException si el estado no es válido', () => {
      const solicitud = new SolicitudMaterial();
      solicitud.estado =
        'ESTADO_INEXISTENTE' as unknown as EstadoSolicitudMaterial;

      expect(() => solicitud.validar()).toThrow(BadRequestException);
      expect(() => solicitud.validar()).toThrow(
        'Estado de solicitud no válido: ESTADO_INEXISTENTE',
      );
    });
  });

  describe('Estructura de Detalle (DetalleSolicitudMaterial) y relación con Materiales', () => {
    it('debe existir la clase DetalleSolicitudMaterial', () => {
      expect(DetalleSolicitudMaterial).toBeDefined();
    });

    it('permite asociar múltiples materiales a una misma solicitud mediante su detalle (1:N)', () => {
      const solicitud = new SolicitudMaterial();
      solicitud.id = 8;
      solicitud.codigo = 'SOL-0008';

      const mat1 = new Material();
      mat1.id = 1;
      mat1.nombre = 'Tubo PVC 1/2"';
      mat1.unidadMedida = 'Metro';
      mat1.stockActual = 100;

      const mat2 = new Material();
      mat2.id = 2;
      mat2.nombre = 'Unión PVC';
      mat2.unidadMedida = 'Unidad';
      mat2.stockActual = 50;

      const mat3 = new Material();
      mat3.id = 3;
      mat3.nombre = 'Codo PVC';
      mat3.unidadMedida = 'Unidad';
      mat3.stockActual = 30;

      const detalle1 = new DetalleSolicitudMaterial();
      detalle1.id = 1;
      detalle1.idSolicitud = 8;
      detalle1.solicitud = solicitud;
      detalle1.idMaterial = 1;
      detalle1.material = mat1;
      detalle1.cantidad = 5;

      const detalle2 = new DetalleSolicitudMaterial();
      detalle2.id = 2;
      detalle2.idSolicitud = 8;
      detalle2.solicitud = solicitud;
      detalle2.idMaterial = 2;
      detalle2.material = mat2;
      detalle2.cantidad = 3;

      const detalle3 = new DetalleSolicitudMaterial();
      detalle3.id = 3;
      detalle3.idSolicitud = 8;
      detalle3.solicitud = solicitud;
      detalle3.idMaterial = 3;
      detalle3.material = mat3;
      detalle3.cantidad = 2;

      solicitud.detalles = [detalle1, detalle2, detalle3];

      expect(solicitud.detalles).toHaveLength(3);
      expect(solicitud.detalles[0].material.nombre).toBe('Tubo PVC 1/2"');
      expect(solicitud.detalles[0].cantidad).toBe(5);
      expect(solicitud.detalles[1].material.nombre).toBe('Unión PVC');
      expect(solicitud.detalles[1].cantidad).toBe(3);
      expect(solicitud.detalles[2].material.nombre).toBe('Codo PVC');
      expect(solicitud.detalles[2].cantidad).toBe(2);

      // Verificación de criterio: Registrar una solicitud NO modifica las existencias físicas de los materiales
      expect(mat1.stockActual).toBe(100);
      expect(mat2.stockActual).toBe(50);
      expect(mat3.stockActual).toBe(30);
    });

    it('debe validar que la cantidad solicitada en el detalle sea un entero estrictamente mayor a cero', () => {
      const detalle = new DetalleSolicitudMaterial();
      detalle.cantidad = 0;

      expect(() => detalle.validar()).toThrow(BadRequestException);
      expect(() => detalle.validar()).toThrow(
        'La cantidad solicitada debe ser mayor a cero',
      );

      detalle.cantidad = -4;
      expect(() => detalle.validar()).toThrow(BadRequestException);

      detalle.cantidad = 3.5;
      expect(() => detalle.validar()).toThrow(BadRequestException);
      expect(() => detalle.validar()).toThrow(
        'La cantidad solicitada debe ser un número entero',
      );

      detalle.cantidad = 10;
      expect(() => detalle.validar()).not.toThrow();
    });

    it('debe sanitizar con trim la observación opcional del detalle', () => {
      const detalle = new DetalleSolicitudMaterial();
      detalle.cantidad = 5;
      detalle.observacion = '  Para acople de salida  ';

      detalle.validar();
      expect(detalle.observacion).toBe('Para acople de salida');

      detalle.observacion = '   ';
      detalle.validar();
      expect(detalle.observacion).toBeNull();
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('debe estar registrada la tabla SolicitudMaterial', () => {
      const table = storage.tables.find(
        (t) => t.target === SolicitudMaterial || t.name === 'SolicitudMaterial',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('SolicitudMaterial');
    });

    it('debe estar registrada la tabla DetalleSolicitudMaterial', () => {
      const table = storage.tables.find(
        (t) =>
          t.target === DetalleSolicitudMaterial ||
          t.name === 'DetalleSolicitudMaterial',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('DetalleSolicitudMaterial');
    });

    it('SolicitudMaterial debe tener llave primaria autoincremental id', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === SolicitudMaterial && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();
      const generated = storage.generations.find(
        (g) => g.target === SolicitudMaterial && g.propertyName === 'id',
      );
      expect(generated?.strategy).toBe('increment');
    });

    it('DetalleSolicitudMaterial debe tener llave primaria autoincremental id', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === DetalleSolicitudMaterial && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();
      const generated = storage.generations.find(
        (g) => g.target === DetalleSolicitudMaterial && g.propertyName === 'id',
      );
      expect(generated?.strategy).toBe('increment');
    });

    it('SolicitudMaterial debe tener configuradas todas las columnas requeridas', () => {
      const columns = storage.columns
        .filter((c) => c.target === SolicitudMaterial)
        .map((c) => c.propertyName);

      expect(columns).toContain('id');
      expect(columns).toContain('codigo');
      expect(columns).toContain('fechaSolicitud');
      expect(columns).toContain('estado');
      expect(columns).toContain('observacion');
      expect(columns).toContain('idFontanero');
      expect(columns).toContain('idAveria');
      expect(columns).toContain('idUsuarioAprobador');
      expect(columns).toContain('fechaRevision');
      expect(columns).toContain('motivoRechazo');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });

    it('SolicitudMaterial debe relacionar el Fontanero con Usuario de forma obligatoria', () => {
      const relation = storage.relations.find(
        (r) => r.target === SolicitudMaterial && r.propertyName === 'fontanero',
      );
      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(false);

      const join = storage.joinColumns.find(
        (j) => j.target === SolicitudMaterial && j.propertyName === 'fontanero',
      );
      expect(join?.name).toBe('idFontanero');
      expect(join?.referencedColumnName).toBe('idUsuario');
    });

    it('SolicitudMaterial debe relacionar opcionalmente con Averia', () => {
      const relation = storage.relations.find(
        (r) => r.target === SolicitudMaterial && r.propertyName === 'averia',
      );
      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(true);
      expect(relation?.options.onDelete).toBe('SET NULL');

      const join = storage.joinColumns.find(
        (j) => j.target === SolicitudMaterial && j.propertyName === 'averia',
      );
      expect(join?.name).toBe('idAveria');
    });

    it('SolicitudMaterial debe relacionar con DetalleSolicitudMaterial en OneToMany con cascade', () => {
      const relation = storage.relations.find(
        (r) => r.target === SolicitudMaterial && r.propertyName === 'detalles',
      );
      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('one-to-many');
      expect(relation?.options.cascade).toBe(true);
    });

    it('DetalleSolicitudMaterial debe relacionar con Material y con SolicitudMaterial', () => {
      const relSolicitud = storage.relations.find(
        (r) =>
          r.target === DetalleSolicitudMaterial &&
          r.propertyName === 'solicitud',
      );
      expect(relSolicitud).toBeDefined();
      expect(relSolicitud?.relationType).toBe('many-to-one');
      expect(relSolicitud?.options.onDelete).toBe('CASCADE');

      const relMaterial = storage.relations.find(
        (r) =>
          r.target === DetalleSolicitudMaterial &&
          r.propertyName === 'material',
      );
      expect(relMaterial).toBeDefined();
      expect(relMaterial?.relationType).toBe('many-to-one');
      expect(relMaterial?.options.nullable).toBe(false);
    });

    it('Material debe tener la relación inversa detallesSolicitud', () => {
      const relation = storage.relations.find(
        (r) => r.target === Material && r.propertyName === 'detallesSolicitud',
      );
      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('one-to-many');
    });

    it('SolicitudMaterial y DetalleSolicitudMaterial deben usar createdAt y updatedAt como fechas de auditoría', () => {
      const createdSol = storage.columns.find(
        (c) => c.target === SolicitudMaterial && c.propertyName === 'createdAt',
      );
      const updatedSol = storage.columns.find(
        (c) => c.target === SolicitudMaterial && c.propertyName === 'updatedAt',
      );
      expect(createdSol?.mode).toBe('createDate');
      expect(updatedSol?.mode).toBe('updateDate');

      const createdDet = storage.columns.find(
        (c) =>
          c.target === DetalleSolicitudMaterial &&
          c.propertyName === 'createdAt',
      );
      const updatedDet = storage.columns.find(
        (c) =>
          c.target === DetalleSolicitudMaterial &&
          c.propertyName === 'updatedAt',
      );
      expect(createdDet?.mode).toBe('createDate');
      expect(updatedDet?.mode).toBe('updateDate');
    });
  });
});
