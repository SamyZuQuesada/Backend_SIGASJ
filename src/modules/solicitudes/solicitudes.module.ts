import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { FormularioOficial } from './entities/formulario-oficial.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';

import { FormulariosOficialesController } from './formularios-oficiales.controller';
import { FormulariosOficialesService } from './formularios-oficiales.service';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { TiposSolicitudController } from './tipos-solicitud.controller';
import { TiposSolicitudService } from './tipos-solicitud.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudServicio,
      TipoSolicitud,
      Solicitud,
      SolicitudArregloPago,
      SolicitudCambioTitular,
      SolicitudInfraestructuraLinderos,
      SolicitudAfiliacion,
      SolicitudDisponibilidadServicios,
      SolicitudConstanciaServicio,
      DocumentoSolicitud,
      HistorialSolicitud,
      FormularioOficial,
    ]),
  ],
  controllers: [
    SolicitudesController,
    TiposSolicitudController,
    FormulariosOficialesController,
  ],
  providers: [
    SolicitudesService,
    TiposSolicitudService,
    FormulariosOficialesService,
    RolesGuard,
  ],
  exports: [
    SolicitudesService,
    TiposSolicitudService,
    FormulariosOficialesService,
    TypeOrmModule,
  ],
})
export class SolicitudesModule {}
