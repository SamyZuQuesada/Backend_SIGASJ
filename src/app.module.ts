import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageModule } from './common/storage/file-storage.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import environmentConfig from './config/environment.config';
import { buildTypeOrmOptions } from './config/database.config';
import jwtConfig from './config/jwt.config';
import acueductosCrConfig from './config/acueductos-cr.config';

import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ContenidoPublicoModule } from './modules/contenido-publico/contenido-publico.module';
import { ComunicadosModule } from './modules/comunicados/comunicados.module';
import { AbonadosModule } from './modules/abonados/abonados.module';
import { AveriasModule } from './modules/averias/averias.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { LecturasModule } from './modules/lecturas/lecturas.module';
import { ConsumosModule } from './modules/consumos/consumos.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { ActividadesFontaneroModule } from './modules/actividades-fontanero/actividades-fontanero.module';
import { ProyectosModule } from './modules/proyectos/proyectos.module';
import { RecibosModule } from './modules/recibos/recibos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [environmentConfig, jwtConfig, acueductosCrConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmOptions(configService),
    }),
    FileStorageModule,
    AuthModule,
    UsuariosModule,
    ContenidoPublicoModule,
    ComunicadosModule,
    AbonadosModule,
    AveriasModule,
    SolicitudesModule,
    LecturasModule,
    ConsumosModule,
    InventarioModule,
    ActividadesFontaneroModule,
    ProyectosModule,
    RecibosModule,
  ],

  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
