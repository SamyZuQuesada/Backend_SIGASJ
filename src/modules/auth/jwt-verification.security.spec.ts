import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Role } from '../../common/enums/role.enum';
import jwtConfig from '../../config/jwt.config';
import { JwtStrategy } from './strategies/jwt.strategy';

@Controller('secure-probe')
class SecureProbeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  ok() {
    return { ok: true };
  }
}

describe('JWT verification — 401 cases', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const secret = 'super_secret_jwt_key_sigasj_2026';

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [SecureProbeController],
      providers: [JwtStrategy],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const payload = {
    sub: '1',
    email: 'probe@asadasanjuan.cr',
    role: Role.ADMINISTRADORA,
    name: 'Probe',
  };

  it('sin token → 401', async () => {
    await request(app.getHttpServer()).get('/secure-probe').expect(401);
  });

  it('token malformado → 401', async () => {
    await request(app.getHttpServer())
      .get('/secure-probe')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('token expirado → 401', async () => {
    const expired = jwtService.sign(payload, { expiresIn: -10 });
    await request(app.getHttpServer())
      .get('/secure-probe')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('firma incorrecta → 401', async () => {
    const other = new JwtService({ secret: 'otra-clave-distinta-no-prod' });
    const bad = other.sign(payload, { expiresIn: '1h' });
    await request(app.getHttpServer())
      .get('/secure-probe')
      .set('Authorization', `Bearer ${bad}`)
      .expect(401);
  });

  it('token válido → 200', async () => {
    const token = jwtService.sign(payload);
    await request(app.getHttpServer())
      .get('/secure-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('payload manipulado sin re-firmar → 401', async () => {
    const token = jwtService.sign(payload);
    const [h, p] = token.split('.');
    const body = JSON.parse(
      Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf8',
      ),
    ) as Record<string, unknown>;
    body.role = Role.ADMINISTRADORA;
    body.email = 'atacante@example.com';
    const tampered = `${h}.${Buffer.from(JSON.stringify(body)).toString('base64url')}.tampered`;
    await request(app.getHttpServer())
      .get('/secure-probe')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
  });
});
