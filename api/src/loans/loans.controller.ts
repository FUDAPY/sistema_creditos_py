import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import {
  AnularLoanDto,
  CreateLoanDto,
  EditLoanDto,
  RedirectLoanDto,
  UpdateLoanMetaDto,
} from './dto/loan.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('collectorId') collectorId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.loansService.list(user.companyId, {
      status,
      approvalStatus,
      collectorId,
    });
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    const loan = await this.loansService.getById(user.companyId, id);
    if (!loan) throw new Error('Credito no encontrado.');
    return loan;
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateLoanDto,
  ): Promise<Record<string, unknown>> {
    return this.loansService.create(user.companyId, dto, user);
  }

  @Roles('ADMIN')
  @Post(':id/approve')
  async approve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.loansService.approve(user.companyId, id, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Patch(':id/meta')
  async updateMeta(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateLoanMetaDto,
  ): Promise<{ success: boolean }> {
    await this.loansService.updateAdminMeta(user.companyId, id, dto, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Patch(':id')
  edit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: EditLoanDto,
  ): Promise<Record<string, unknown>> {
    return this.loansService.edit(user.companyId, id, dto, user);
  }

  @Roles('ADMIN')
  @Post(':id/inforconf')
  async confirmInforconf(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.loansService.confirmInforconf(user.companyId, id, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/freeze')
  async freeze(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.loansService.freeze(user.companyId, id, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/redirect')
  async redirect(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RedirectLoanDto,
  ): Promise<{ success: boolean }> {
    await this.loansService.redirect(user.companyId, id, dto, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/anular')
  async anular(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AnularLoanDto,
  ): Promise<{ success: boolean }> {
    await this.loansService.anular(user.companyId, id, dto.reason, user);
    return { success: true };
  }
}
