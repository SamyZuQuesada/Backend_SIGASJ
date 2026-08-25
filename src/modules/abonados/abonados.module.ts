import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SolicitudServicio } from '../solicitudes/entities/solicitud-servicio.entity';
import { Servicio } from '../servicios/entities/servicio.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AbonadosController } from './abonados.controller';
import { AbonadosService } from './abonados.service';
import { Abonado } from './entities/abonado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Abonado,
      Usuario,
      Servicio,
      SolicitudServicio,
    ]),
  ],
  controllers: [AbonadosController],
  providers: [AbonadosService, RolesGuard],
  exports: [AbonadosService],
})
export class AbonadosModule {}
