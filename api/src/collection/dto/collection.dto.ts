import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class DailyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  date?: number;

  @IsOptional()
  @IsString()
  collectorId?: string;
}

export class PaymentDayLockDto {
  @Type(() => Number)
  @IsNumber()
  dateDay!: number;

  @IsOptional()
  @IsString()
  collectorId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
