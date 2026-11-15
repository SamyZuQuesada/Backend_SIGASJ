import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  hashPassword,
  PasswordHashingError,
  PasswordInputError,
  verifyPassword,
} from './password.util';

/**
 * Única fachada Nest para hashing/comparación. No toca BD, JWT ni roles.
 * La implementación bcrypt vive en `password.util` (también usada por
 * migraciones y helpers de test, que no pueden inyectar este servicio).
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  async hash(plain: string): Promise<string> {
    try {
      return await hashPassword(plain);
    } catch (error) {
      if (error instanceof PasswordInputError) {
        throw new BadRequestException('La contraseña no es válida.');
      }
      this.logger.error('Error generating password hash');
      throw new InternalServerErrorException(
        'No fue posible procesar las credenciales.',
      );
    }
  }

  async compare(plain: string, passwordHash: string): Promise<boolean> {
    try {
      return await verifyPassword(plain, passwordHash);
    } catch (error) {
      if (error instanceof PasswordHashingError) {
        this.logger.error('Error comparing password hash');
      }
      return false;
    }
  }
}
