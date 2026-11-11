import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../common/enums/role.enum';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController (delgado)', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'token',
        user: {
          id: 1,
          email: 'a@test.local',
          role: Role.ADMINISTRADORA,
          name: 'Admin',
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('se instancia y delega login en AuthService', async () => {
    expect(controller).toBeDefined();
    const dto: LoginDto = {
      email: 'a@test.local',
      password: 'Secret1!',
    };
    const result = await controller.login(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result.accessToken).toBe('token');
    expect(result.user).toEqual(
      expect.objectContaining({ role: Role.ADMINISTRADORA }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });
});
