import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { RecursosHumanosModule } from '../recursos-humanos/recursos-humanos.module';
import { Colaborador } from '../recursos-humanos/entities/colaborador.entity';
import { CorrelacionSolicitudAusenciaService } from './correlacion-solicitud-ausencia.service';
import { CorrelacionSolicitudAusencia } from './entities/correlacion-solicitud-ausencia.entity';
import { DocumentoSolicitudAusencia } from './entities/documento-solicitud-ausencia.entity';
import { SolicitudAusencia } from './entities/solicitud-ausencia.entity';
import { JotformWebhookController } from './jotform-webhook.controller';
import { JotformWebhookService } from './jotform-webhook.service';
import { FontaneroSolicitudesAusenciaController } from './fontanero-solicitudes-ausencia.controller';
import { SolicitudesAusenciaController } from './solicitudes-ausencia.controller';
import { NotificacionSolicitudAusenciaService } from './notificacion-solicitud-ausencia.service';
import { SolicitudesAusenciaService } from './solicitudes-ausencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudAusencia,
      DocumentoSolicitudAusencia,
      CorrelacionSolicitudAusencia,
      Colaborador,
    ]),
    RecursosHumanosModule,
    NotificacionesModule,
  ],
  controllers: [
    JotformWebhookController,
    SolicitudesAusenciaController,
    FontaneroSolicitudesAusenciaController,
  ],
  providers: [
    SolicitudesAusenciaService,
    CorrelacionSolicitudAusenciaService,
    JotformWebhookService,
    NotificacionSolicitudAusenciaService,
  ],
  exports: [SolicitudesAusenciaService],
})
export class SolicitudesAusenciaModule {}
