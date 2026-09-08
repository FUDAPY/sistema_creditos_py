import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSlotMachineSiteDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  locationName!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @IsNotEmpty()
  collectorId!: string;

  @IsString()
  @IsNotEmpty()
  collectorName!: string;
}

export class CreateSlotMachineEntryDto {
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @IsString()
  siteName!: string;

  @IsString()
  locationName!: string;

  @IsString()
  @IsNotEmpty()
  collectorId!: string;

  @IsString()
  @IsNotEmpty()
  collectorName!: string;

  @IsNumber()
  collectionDate!: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SlotEntryQueryDto {
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED'])
  approvalStatus?: 'PENDING' | 'APPROVED';

  @IsOptional()
  @IsString()
  collectorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dateFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dateTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxResults?: number;
}

export class RejectSlotEntryDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
