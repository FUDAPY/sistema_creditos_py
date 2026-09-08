import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SpecialLoansService } from './special-loans.service';
import { RentalPaymentRecordDto, RentalRenewDto } from './dto/special.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly specialService: SpecialLoansService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.specialService.listByType(user.companyId, 'ALQUILER_INMUEBLE');
  }

  @Get(':id')
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.specialService.getById(user.companyId, id, 'ALQUILER_INMUEBLE');
  }

  @Roles('ADMIN')
  @Post(':id/renew')
  async renew(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RentalRenewDto,
  ): Promise<{ success: boolean }> {
    await this.specialService.renewRental(user.companyId, id, dto.renewalMonths, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/record-payment')
  async recordPayment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RentalPaymentRecordDto,
  ): Promise<{ success: boolean }> {
    await this.specialService.recordRentalPayment(user.companyId, id, dto.periodMonthCount, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/terminate')
  async terminate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.specialService.terminateRental(user.companyId, id, user);
    return { success: true };
  }
}
