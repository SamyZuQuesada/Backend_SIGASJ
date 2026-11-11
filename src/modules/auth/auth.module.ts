import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsuariosCoreModule } from '../usuarios/usuarios-core.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordModule } from './password.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PasswordModule,
    UsuariosCoreModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error(
            'jwt.secret no configurado. Defina JWT_SECRET (obligatorio en producción).',
          );
        }
        return {
          secret,
          signOptions: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            expiresIn: (configService.get<string>('jwt.expiresIn') ||
              '24h') as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule, PasswordModule],
})
export class AuthModule {}
