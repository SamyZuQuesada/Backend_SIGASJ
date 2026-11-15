import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordModule } from '../auth/password.module';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

/**
 * Núcleo Usuario + Rol para Auth y consumidores que no necesitan horarios.
 * Evita dependencia circular Auth ↔ Usuarios y entidades ajenas en AuthModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol]), PasswordModule],
  providers: [UsuariosService],
  exports: [UsuariosService, TypeOrmModule],
})
export class UsuariosCoreModule {}
