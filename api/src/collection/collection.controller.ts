import { Controller, Get, Param, Post, Query, Body } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CurrentUser } from '../common/decorators';
import type { RequestUser } from '../common/types';
import { DailyQueryDto, PaymentDayLockDto } from './dto/collection.dto';

@Controller('collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('collectorId') collectorId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.collectionService.list(user.companyId, collectorId);
  }

  /** Gestion diaria: creditos que vencen el dia + estado de gestion + locks. */
  @Get('daily')
  daily(
    @CurrentUser() user: RequestUser,
    @Query() query: DailyQueryDto,
  ): Promise<Record<string, unknown>[]> {
    const collectorId =
      user.role !== 'ADMIN' ? user.uid : query.collectorId;
    return this.collectionService.dailySummary(user.companyId, query.date, collectorId);
  }

  @Get('locks')
  locks(
    @CurrentUser() user: RequestUser,
    @Query() query: DailyQueryDto,
  ): Promise<Record<string, unknown>[]> {
    return this.collectionService.listLocks(user.companyId, {
      dateDay: query.date,
      collectorId: query.collectorId,
    });
  }

  @Post('locks')
  async lockDay(
    @CurrentUser() user: RequestUser,
    @Body() dto: PaymentDayLockDto,
  ): Promise<{ success: boolean }> {
    await this.collectionService.lockDay(
      user.companyId,
      dto.dateDay,
      user.role !== 'ADMIN' ? user.uid : dto.collectorId,
      dto.reason || '',
      user,
    );
    return { success: true };
  }

  @Post('locks/unlock')
  async unlockDay(
    @CurrentUser() user: RequestUser,
    @Body() dto: PaymentDayLockDto,
  ): Promise<{ success: boolean }> {
    await this.collectionService.unlockDay(
      user.companyId,
      dto.dateDay,
      user.role !== 'ADMIN' ? user.uid : dto.collectorId,
      user,
    );
    return { success: true };
  }

  @Post(':loanId/managed')
  async markManaged(
    @CurrentUser() user: RequestUser,
    @Param('loanId') loanId: string,
  ): Promise<{ success: boolean }> {
    await this.collectionService.markManaged(user.companyId, loanId, user);
    return { success: true };
  }

  @Post(':loanId/contacted')
  async markContacted(
    @CurrentUser() user: RequestUser,
    @Param('loanId') loanId: string,
  ): Promise<{ success: boolean }> {
    await this.collectionService.markContacted(user.companyId, loanId, user);
    return { success: true };
  }
}
