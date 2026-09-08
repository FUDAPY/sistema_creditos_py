import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService, type LoginResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public, CurrentUser } from '../common/decorators';
import type { RequestUser } from '../common/types';
import { UsersService, type PublicUser } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @Get('me')
  async me(@CurrentUser() current: RequestUser): Promise<PublicUser | null> {
    const doc = await this.usersService.findByUid(current.companyId, current.uid);
    return doc ? this.usersService.toPublicUser(doc) : null;
  }
}
