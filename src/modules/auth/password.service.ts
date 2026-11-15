import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  comparePassword,
  hashPassword,
  resolveBcryptRounds,
} from './password.util';

/**
 * Única responsabilidad Nest para hashing/comparación de contraseñas.
 * No consulta DB, no emite JWT, no valida política de password (eso va en DTOs).
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(private readonly configService: ConfigService) {}

  private rounds(): number {
    return resolveBcryptRounds(
      this.configService.get<number>('auth.bcryptRounds'),
    );
  }

  async hashPassword(plain: string): Promise<string> {
    try {
      return await hashPassword(plain, this.rounds());
    } catch {
      this.logger.error('Error generating password hash');
      throw new InternalServerErrorException(
        'No se pudo procesar la contraseña.',
      );
    }
  }

  async comparePassword(plain: string, passwordHash: string): Promise<boolean> {
    return comparePassword(plain, passwordHash);
  }
}
