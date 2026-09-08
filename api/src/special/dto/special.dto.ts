import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ExtendPawnDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  extensionDays!: number;
}

export class RentalRenewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  renewalMonths!: number;
}

export class RentalPaymentRecordDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodMonthCount!: number;
}

export class ServiceDeliverDto {
  @Type(() => Number)
  @IsNumber()
  deliveryDate!: number;
}

export class ServiceDescriptionDto {
  @IsString()
  @IsNotEmpty()
  description!: string;
}
