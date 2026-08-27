import { EstadoProyecto, isEstadoProyectoValido } from '../common/enums/estado-proyecto.enum';
import { CreateProyectosAndImagenProyectoTables1724684000000 } from './migrations/1724684000000-CreateProyectosAndImagenProyectoTables';
import { ImagenProyecto } from '../modules/proyectos/entities/imagen-proyecto.entity';
import { Proyecto } from '../modules/proyectos/entities/proyecto.entity';

// Repositorio en memoria para simular el almacenamiento e integridad de base de datos SQL Server
class ProyectosMemoryDatabase {
  private proyectos: Map<number, Proyecto> = new Map();
  private imagenes: Map<number, ImagenProyecto> = new Map();
  private nextProyectoId = 1;
  private nextImagenId = 1;

  async saveProyecto(
    datos: Omit<Partial<Proyecto>, 'imagenes'> & { imagenes?: Partial<ImagenProyecto>[] },
  ): Promise<Proyecto> {
    const now = new Date();
    const id = datos.id || this.nextProyectoId++;

    const proyecto: Proyecto = {
      id,
      nombre: datos.nombre || '',
      descripcion: datos.descripcion ?? null,
      encargadoRealizacion: datos.encargadoRealizacion ?? null,
      duracion: datos.duracion ?? null,
      estado: datos.estado || EstadoProyecto.PENDIENTE,
      imagenPrincipal: datos.imagenPrincipal ?? null,
      activo: datos.activo !== undefined ? datos.activo : false,
      createdAt: datos.createdAt || now,
      updatedAt: now,
      imagenes: [],
    };

    this.proyectos.set(id, proyecto);

    if (datos.imagenes && Array.isArray(datos.imagenes)) {
      const imagenesGuardadas: ImagenProyecto[] = [];
      for (const imgData of datos.imagenes) {
        const img = await this.saveImagen({ ...imgData, proyecto });
        imagenesGuardadas.push(img);
      }
      proyecto.imagenes = imagenesGuardadas;
    } else {
      proyecto.imagenes = this.getImagenesPorProyecto(id);
    }

    return proyecto;
  }

  async saveImagen(datos: Partial<ImagenProyecto>): Promise<ImagenProyecto> {
    const now = new Date();
    const id = datos.id || this.nextImagenId++;

    if (!datos.proyecto || !datos.proyecto.id || !this.proyectos.has(datos.proyecto.id)) {
      throw new Error('FK Constraint Error: No existe el proyecto referenciado');
    }

    const imagen: ImagenProyecto = {
      id,
      url: datos.url || '',
      descripcion: datos.descripcion ?? null,
      orden: datos.orden ?? 0,
      proyecto: datos.proyecto as Proyecto,
      createdAt: datos.createdAt || now,
    };

    this.imagenes.set(id, imagen);
    return imagen;
  }

  getProyectoById(id: number): Proyecto | undefined {
    const proyecto = this.proyectos.get(id);
    if (!proyecto) return undefined;

    const imgs = this.getImagenesPorProyecto(id);
    return { ...proyecto, imagenes: imgs };
  }

  getImagenesPorProyecto(proyectoId: number): ImagenProyecto[] {
    return Array.from(this.imagenes.values()).filter((img) => img.proyecto.id === proyectoId);
  }

  async deleteProyectoCascade(id: number): Promise<boolean> {
    if (!this.proyectos.has(id)) return false;

    // Simular FK CASCADE DELETE
    for (const [imgId, img] of this.imagenes.entries()) {
      if (img.proyecto.id === id) {
        this.imagenes.delete(imgId);
      }
    }

    this.proyectos.delete(id);
    return true;
  }
}

describe('Pruebas de Base de Datos e Integridad: Proyecto e ImagenProyecto', () => {
  let db: ProyectosMemoryDatabase;

  beforeEach(() => {
    db = new ProyectosMemoryDatabase();
  });

  describe('1. Pruebas de Persistencia del Modelo Proyecto', () => {
    it('debe crear un proyecto de prueba y guardar todos sus campos requeridos u opcionales', async () => {
      const datosNuevoProyecto = {
        nombre: 'Construcción Tanque de Almacenamiento',
        descripcion: 'Construcción de tanque de 500,000 litros para contingencias.',
        encargadoRealizacion: 'Ing. María Rodríguez',
        duracion: '8 meses',
        estado: EstadoProyecto.EN_PROCESO,
        imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
        activo: true,
      };

      const proyectoGuardado = await db.saveProyecto(datosNuevoProyecto);

      expect(proyectoGuardado.id).toBeDefined();
      expect(proyectoGuardado.nombre).toBe('Construcción Tanque de Almacenamiento');
      expect(proyectoGuardado.descripcion).toBe('Construcción de tanque de 500,000 litros para contingencias.');
      expect(proyectoGuardado.encargadoRealizacion).toBe('Ing. María Rodríguez');
      expect(proyectoGuardado.duracion).toBe('8 meses');
      expect(proyectoGuardado.estado).toBe(EstadoProyecto.EN_PROCESO);
      expect(proyectoGuardado.imagenPrincipal).toBe('https://ejemplo.com/tanque.jpg');
      expect(proyectoGuardado.activo).toBe(true);
      expect(proyectoGuardado.createdAt).toBeInstanceOf(Date);
      expect(proyectoGuardado.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('2. Pruebas de Estados de Proyecto', () => {
    it('debe permitir crear proyectos en los estados oficiales PENDIENTE, EN_PROCESO y COMPLETADO', async () => {
      const pPendiente = await db.saveProyecto({
        nombre: 'Proyecto Pendiente',
        estado: EstadoProyecto.PENDIENTE,
      });

      const pEnProceso = await db.saveProyecto({
        nombre: 'Proyecto En Proceso',
        estado: EstadoProyecto.EN_PROCESO,
      });

      const pCompletado = await db.saveProyecto({
        nombre: 'Proyecto Completado',
        estado: EstadoProyecto.COMPLETADO,
      });

      expect(pPendiente.estado).toBe('PENDIENTE');
      expect(pEnProceso.estado).toBe('EN_PROCESO');
      expect(pCompletado.estado).toBe('COMPLETADO');
    });

    it('debe detectar y rechazar el uso de estados inválidos o improvisados', () => {
      const estadosInvalidos = ['Terminado', 'Finalizado', 'Trabajando', 'Iniciado', 'Por hacer'];

      estadosInvalidos.forEach((estadoIncorrecto) => {
        expect(isEstadoProyectoValido(estadoIncorrecto)).toBe(false);
      });
    });

    it('debe crear el proyecto inactivo para publicación sin alterar el estado de ejecución', async () => {
      const proyecto = await db.saveProyecto({
        nombre: 'Proyecto recién registrado',
        estado: EstadoProyecto.PENDIENTE,
      });

      expect(proyecto.estado).toBe(EstadoProyecto.PENDIENTE);
      expect(proyecto.activo).toBe(false);
    });
  });

  describe('3. Pruebas de la Galería de Imágenes (ImagenProyecto)', () => {
    it('debe permitir crear un proyecto sin imágenes adicionales (galería vacía)', async () => {
      const proyectoSinImagenes = await db.saveProyecto({
        nombre: 'Proyecto Sin Fotos',
        estado: EstadoProyecto.PENDIENTE,
      });

      const recuperado = db.getProyectoById(proyectoSinImagenes.id);
      expect(recuperado).toBeDefined();
      expect(recuperado?.imagenes).toHaveLength(0);
    });

    it('debe agregar una fotografía adicional y asociarla al proyecto correcto', async () => {
      const proyecto = await db.saveProyecto({
        nombre: 'Proyecto con 1 foto',
        estado: EstadoProyecto.EN_PROCESO,
      });

      await db.saveImagen({
        url: 'https://ejemplo.com/foto1.jpg',
        descripcion: 'Foto inicial',
        orden: 1,
        proyecto,
      });

      const recuperado = db.getProyectoById(proyecto.id);
      expect(recuperado?.imagenes).toHaveLength(1);
      expect(recuperado?.imagenes[0].url).toBe('https://ejemplo.com/foto1.jpg');
      expect(recuperado?.imagenes[0].orden).toBe(1);
    });

    it('debe agregar múltiples imágenes verificando la relación y el campo de orden', async () => {
      const proyecto = await db.saveProyecto({
        nombre: 'Proyecto con Galería',
        estado: EstadoProyecto.COMPLETADO,
        imagenes: [
          { url: 'https://ejemplo.com/f1.jpg', descripcion: 'Paso 1', orden: 1 },
          { url: 'https://ejemplo.com/f2.jpg', descripcion: 'Paso 2', orden: 2 },
          { url: 'https://ejemplo.com/f3.jpg', descripcion: 'Paso 3', orden: 3 },
        ],
      });

      const recuperado = db.getProyectoById(proyecto.id);
      expect(recuperado?.imagenes).toHaveLength(3);

      const ordenes = recuperado?.imagenes.map((img) => img.orden);
      expect(ordenes).toEqual([1, 2, 3]);
    });
  });

  describe('4. Pruebas de Integridad Referencial de Base de Datos', () => {
    it('debe rechazar guardar una imagen vinculada a un proyecto inexistente (Integridad Referencial FK)', async () => {
      const proyectoInexistente = { id: 9999 } as Proyecto;

      await expect(
        db.saveImagen({
          url: 'https://ejemplo.com/huerfana.jpg',
          proyecto: proyectoInexistente,
        }),
      ).rejects.toThrow('FK Constraint Error');
    });

    it('debe eliminar automáticamente las imágenes al eliminar un proyecto (CASCADE DELETE)', async () => {
      const proyecto = await db.saveProyecto({
        nombre: 'Proyecto a eliminar',
        imagenes: [
          { url: 'https://ejemplo.com/img1.jpg', orden: 1 },
          { url: 'https://ejemplo.com/img2.jpg', orden: 2 },
        ],
      });

      const proyectoId = proyecto.id;
      expect(db.getImagenesPorProyecto(proyectoId)).toHaveLength(2);

      await db.deleteProyectoCascade(proyectoId);

      expect(db.getProyectoById(proyectoId)).toBeUndefined();
      expect(db.getImagenesPorProyecto(proyectoId)).toHaveLength(0);
    });
  });

  describe('5. Pruebas de Definición de Migración SQL Server', () => {
    it('debe contar con la migración para crear las tablas Proyecto e ImagenProyecto', () => {
      const migration = new CreateProyectosAndImagenProyectoTables1724684000000();
      expect(migration.name).toBe('CreateProyectosAndImagenProyectoTables1724684000000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });
  });
});
