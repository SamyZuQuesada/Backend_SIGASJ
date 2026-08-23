import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudServicio])],
  controllers: [SolicitudesController],
  providers: [SolicitudesService, RolesGuard],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
