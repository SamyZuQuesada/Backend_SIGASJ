import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { Role } from '../../common/enums/role.enum';
export declare class AuthService {
    private readonly jwtService;
    constructor(jwtService: JwtService);
    login(loginDto: LoginDto): {
        accessToken: string;
        user: {
            id: string;
            email: string;
            role: Role;
            name: string | undefined;
        };
    };
}
