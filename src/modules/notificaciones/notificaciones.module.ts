import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Averia } from '../averias/entities/averia.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { IntentoSmsAveria } from './entities/intento-sms-averia.entity';
import { NotificacionAveria } from './entities/notificacion-averia.entity';
import { NotificacionesAveriasService } from './notificaciones-averias.service';
import { NotificacionesController } from './notificaciones.controller';
import { InfobipSmsAveriaProvider } from './sms-averia-infobip.sender';
import { SmsAveriasService } from './sms-averias.service';
import {
  SMS_AVERIA_SENDER,
  SmsAveriaSinProveedor,
  type SmsAveriaSender,
} from './sms-averia.sender';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificacionAveria,
      IntentoSmsAveria,
      Usuario,
      Rol,
      Averia,
    ]),
  ],
  controllers: [NotificacionesController],
  providers: [
    NotificacionesAveriasService,
    SmsAveriasService,
    {
      provide: SMS_AVERIA_SENDER,
      inject: [{ token: ConfigService, optional: true }],
      useFactory: (config?: ConfigService): SmsAveriaSender => {
        const provider = (
          config?.get<string>('sms.provider') || 'none'
        ).toLowerCase();
        if (config && provider === 'infobip') {
          return new InfobipSmsAveriaProvider(config);
        }
        return new SmsAveriaSinProveedor();
      },
    },
  ],
  exports: [NotificacionesAveriasService, SmsAveriasService, TypeOrmModule],
})
export class NotificacionesModule {}
