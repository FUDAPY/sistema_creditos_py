import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SpecialLoansService } from './special-loans.service';
import { ServiceDeliverDto, ServiceDescriptionDto } from './dto/special.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('services')
export class ServicesController {
  constructor(private readonly specialService: SpecialLoansService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.specialService.listByType(user.companyId, 'PRESTACION_SERVICIOS');
  }

  @Get(':id')
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.specialService.getById(user.companyId, id, 'PRESTACION_SERVICIOS');
  }

  @Roles('ADMIN')
  @Post(':id/deliver')
  async deliver(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ServiceDeliverDto,
  ): Promise<{ success: boolean }> {
    await this.specialService.recordServiceDelivery(user.companyId, id, dto.deliveryDate, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/complete')
  async complete(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.specialService.completeService(user.companyId, id, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Patch(':id/description')
  async updateDescription(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ServiceDescriptionDto,
  ): Promise<{ success: boolean }> {
    await this.specialService.updateServiceDescription(user.companyId, id, dto.description, user);
    return { success: true };
  }
}
