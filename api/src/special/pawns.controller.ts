import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SpecialLoansService } from './special-loans.service';
import { ExtendPawnDto } from './dto/special.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('pawns')
export class PawnsController {
  constructor(private readonly specialService: SpecialLoansService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.specialService.listByType(user.companyId, 'EMPENO');
  }

  @Get(':id')
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.specialService.getById(user.companyId, id, 'EMPENO');
  }

  @Roles('ADMIN')
  @Post(':id/redeem')
  async redeem(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.specialService.redeemPawn(user.companyId, id, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/extend')
  async extend(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ExtendPawnDto,
  ): Promise<{ success: boolean }> {
    await this.specialService.extendPawn(user.companyId, id, dto.extensionDays, user);
    return { success: true };
  }
}
