import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';

/**
 * Módulo dedicado al hashing/comparación de contraseñas.
 * Evita dependencia circular AuthModule ↔ UsuariosModule.
 */
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class PasswordModule {}
