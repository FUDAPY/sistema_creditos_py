import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService, type PublicUser } from './users.service';
import { CreateUserDto, SetUserPasswordDto, UpdateUserDto } from './dto/user.dto';
import { Roles, CurrentUser } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  private companyId(): string {
    return this.config.get<string>('COMPANY_ID', 'lin_group_sa_001');
  }

  @Get()
  list(@Query('activeOnly') activeOnly?: string): Promise<PublicUser[]> {
    return this.usersService.list(this.companyId(), activeOnly === 'true');
  }

  @Get('me')
  async me(@CurrentUser() current: RequestUser): Promise<PublicUser | null> {
    const doc = await this.usersService.findByUid(this.companyId(), current.uid);
    return doc ? this.usersService.toPublicUser(doc) : null;
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.usersService.create({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      password: dto.password,
      isActive: dto.isActive,
      companyId: dto.companyId,
    });
  }

  @Patch(':uid')
  update(@Param('uid') uid: string, @Body() dto: UpdateUserDto): Promise<PublicUser> {
    return this.usersService.update(this.companyId(), uid, dto);
  }

  @Post(':uid/password')
  async setPassword(@Param('uid') uid: string, @Body() dto: SetUserPasswordDto): Promise<{ success: boolean }> {
    await this.usersService.setPassword(this.companyId(), uid, dto.password);
    return { success: true };
  }
}
