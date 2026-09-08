import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { PaymentType } from '@syscreditos/shared';

export class RegisterPaymentDto {
  @IsString()
  @IsNotEmpty()
  loanId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(['CAPITAL', 'INTEREST', 'MIXED'])
  paymentType?: PaymentType;

  @IsOptional()
  @IsNumber()
  paidAt?: number;
}

export class ApprovePaymentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectPaymentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
