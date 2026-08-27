import { TypeOrmModule } from '@nestjs/typeorm';
import { Abonado } from '../../src/modules/abonados/entities/abonado.entity';
import { Comunicado } from '../../src/modules/comunicados/entities/comunicado.entity';
import { ContactoUbicacion } from '../../src/modules/contenido-publico/entities/contacto-ubicacion.entity';
import { GaleriaFoto } from '../../src/modules/contenido-publico/entities/galeria-foto.entity';
import { TransparenciaDocumento } from '../../src/modules/contenido-publico/entities/transparencia-documento.entity';
import { ImagenProyecto } from '../../src/modules/proyectos/entities/imagen-proyecto.entity';
import { Proyecto } from '../../src/modules/proyectos/entities/proyecto.entity';
import { Usuario } from '../../src/modules/usuarios/entities/usuario.entity';

export const e2eTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [
    Abonado,
    Usuario,
    Comunicado,
    GaleriaFoto,
    ContactoUbicacion,
    TransparenciaDocumento,
    Proyecto,
    ImagenProyecto,
  ],
  synchronize: true,
});
