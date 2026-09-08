import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService, type PublicUser } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'COLLECTOR';
  companyId: string;
}

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const companyId = dto.companyId?.trim() || this.config.get<string>('COMPANY_ID', 'lin_group_sa_001');

    const user = await this.usersService.findByCompanyAndEmail(companyId, dto.email, true);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo. Contacte al administrador.');
    }

    const payload: JwtPayload = {
      sub: user.uid ?? user._id,
      uid: user.uid ?? user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: this.usersService.toPublicUser(user) };
  }
}
