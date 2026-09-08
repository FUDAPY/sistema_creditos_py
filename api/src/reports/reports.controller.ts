import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('portfolio')
  portfolio(
    @CurrentUser() user: RequestUser,
    @Query('collectorId') collectorId?: string,
    @Query('loanType') loanType?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.reportsService.portfolio(user.companyId, user.role, user.uid, {
      collectorId,
      loanType,
    });
  }

  @Get('consultores')
  consultores(
    @CurrentUser() user: RequestUser,
    @Query('collectorId') collectorId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.reportsService.consultorSummary(user.companyId, user.role, user.uid, {
      collectorId,
      dateFrom: dateFrom ? Number(dateFrom) : undefined,
      dateTo: dateTo ? Number(dateTo) : undefined,
    });
  }
}
