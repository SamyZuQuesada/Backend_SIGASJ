import { Injectable } from '@nestjs/common';

@Injectable()
export class UsuariosService {
  findAll() {
    return { message: 'Listado base de usuarios para la arquitectura SIGASJ' };
  }
}
