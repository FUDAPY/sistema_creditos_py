import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SlotMachinesService } from './slot-machines.service';
import {
  CreateSlotMachineEntryDto,
  CreateSlotMachineSiteDto,
  RejectSlotEntryDto,
  SlotEntryQueryDto,
} from './dto/slot-machine.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('slot-machines')
export class SlotMachinesController {
  constructor(private readonly slotMachinesService: SlotMachinesService) {}

  @Get('sites')
  sites(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.slotMachinesService.listSites(user.companyId, user.role, user.uid);
  }

  @Roles('ADMIN')
  @Post('sites')
  createSite(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSlotMachineSiteDto,
  ): Promise<Record<string, unknown>> {
    return this.slotMachinesService.createSite(user.companyId, dto, user);
  }

  @Get('entries/approval')
  entriesForApproval(
    @CurrentUser() user: RequestUser,
    @Query() query: SlotEntryQueryDto,
  ): Promise<Record<string, unknown>[]> {
    return this.slotMachinesService.listEntriesForApproval(user.companyId, user.role, user.uid, {
      approvalStatus: query.approvalStatus,
      collectorId: query.collectorId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      maxResults: query.maxResults,
    });
  }

  @Get('entries')
  entries(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.slotMachinesService.listEntries(user.companyId, user.role, user.uid);
  }

  @Post('entries')
  createEntry(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSlotMachineEntryDto,
  ): Promise<Record<string, unknown>> {
    return this.slotMachinesService.createEntry(user.companyId, dto, user);
  }

  @Roles('ADMIN')
  @Post('entries/:id/approve')
  async approveEntry(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.slotMachinesService.approveEntry(user.companyId, id, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post('entries/:id/unapprove')
  async unapproveEntry(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectSlotEntryDto,
  ): Promise<{ success: boolean }> {
    await this.slotMachinesService.unapproveEntry(user.companyId, id, user, dto.reason || '');
    return { success: true };
  }
}
