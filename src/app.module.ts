import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import environmentConfig from './config/environment.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import authConfig from './config/auth.config';
import acueductosCrConfig from './config/acueductos-cr.config';
import smsConfig from './config/sms.config';
import jotformConfig from './config/jotform.config';
import mailConfig from './config/mail.config';

import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ContenidoPublicoModule } from './modules/contenido-publico/contenido-publico.module';
import { ComunicadosModule } from './modules/comunicados/comunicados.module';
import { AveriasModule } from './modules/averias/averias.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { ActividadesFontaneroModule } from './modules/actividades-fontanero/actividades-fontanero.module';
import { ProyectosModule } from './modules/proyectos/proyectos.module';
import { RecibosModule } from './modules/recibos/recibos.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { AsociadosModule } from './modules/asociados/asociados.module';
import { RecursosHumanosModule } from './modules/recursos-humanos/recursos-humanos.module';
import { SolicitudesAusenciaModule } from './modules/solicitudes-ausencia/solicitudes-ausencia.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        environmentConfig,
        databaseConfig,
        jwtConfig,
        authConfig,
        acueductosCrConfig,
        smsConfig,
        jotformConfig,
        mailConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get('database')!,
    }),
    AuthModule,
    UsuariosModule,
    ContenidoPublicoModule,
    ComunicadosModule,
    AveriasModule,
    SolicitudesModule,
    InventarioModule,
    ActividadesFontaneroModule,
    ProyectosModule,
    RecibosModule,
    NotificacionesModule,
    AsociadosModule,
    RecursosHumanosModule,
    SolicitudesAusenciaModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
