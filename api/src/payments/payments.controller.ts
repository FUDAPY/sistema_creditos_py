import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  ApprovePaymentDto,
  DeletePaymentDto,
  RegisterPaymentDto,
  RejectPaymentDto,
  UpdatePaymentAmountDto,
} from './dto/payment.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('loanId') loanId?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('collectorId') collectorId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.paymentsService.list(user.companyId, { loanId, approvalStatus, collectorId });
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    const payment = await this.paymentsService.getById(user.companyId, id);
    if (!payment) throw new Error('Recibo no encontrado.');
    return payment;
  }

  /** Registrar pago -> queda pendiente de aprobacion del ADMIN. */
  @Post()
  register(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterPaymentDto,
  ): Promise<Record<string, unknown>> {
    return this.paymentsService.register(user.companyId, dto, user);
  }

  @Roles('ADMIN')
  @Post(':id/approve')
  async approve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.paymentsService.approve(user.companyId, id, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  async reject(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<{ success: boolean }> {
    await this.paymentsService.reject(user.companyId, id, user, dto.reason || '');
    return { success: true };
  }

  @Roles('ADMIN')
  @Patch(':id')
  async updateAmount(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentAmountDto,
  ): Promise<{ success: boolean }> {
    await this.paymentsService.updateAmount(user.companyId, id, dto.amount, user);
    return { success: true };
  }

  @Roles('ADMIN')
  @Post(':id/anular')
  async deletePayment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DeletePaymentDto,
  ): Promise<{ success: boolean }> {
    await this.paymentsService.deletePayment(user.companyId, id, dto.reason, user);
    return { success: true };
  }
}
