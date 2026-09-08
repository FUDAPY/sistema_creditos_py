import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { CurrencyCode, LoanType, PlanFrecuencia } from '@syscreditos/shared';

export class CreateLoanDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsNumber()
  @Min(0)
  principal!: number;

  @IsEnum(['PYG', 'USD'])
  currency!: CurrencyCode;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  cycleDays?: number;

  @IsEnum(['PRESTAMO', 'EMPENO', 'PRESTACION_SERVICIOS', 'ALQUILER_INMUEBLE', 'CELULAR'])
  loanType!: LoanType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  pawnDescription?: string;

  @IsString()
  @IsNotEmpty()
  collectorId!: string;

  @IsString()
  @IsNotEmpty()
  collectorName!: string;

  @IsNumber()
  grantedAt!: number;

  @IsNumber()
  expiresAt!: number;

  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  @IsOptional()
  @IsBoolean()
  hasPagare?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocatable?: boolean;

  @IsOptional()
  @IsString()
  tomo?: string;

  @IsOptional()
  @IsEnum(['sistema_creditos', 'empeno', 'alquiler', 'prestacion_servicios', 'pos', 'juridico'])
  origen?: string;

  @IsOptional()
  @IsEnum(['ANUAL', 'MENSUAL'])
  planFrecuencia?: PlanFrecuencia;

  @IsOptional()
  @IsNumber()
  cantidadCuotas?: number;

  @IsOptional()
  @IsNumber()
  montoCuota?: number;
}

export class UpdateLoanMetaDto {
  @IsOptional()
  @IsBoolean()
  hasPagare?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocatable?: boolean;
}

export class EditLoanDto {
  @IsNumber()
  @Min(0)
  principal!: number;

  @IsNumber()
  interestRate!: number;

  @IsOptional()
  @IsNumber()
  cycleDays?: number;

  @IsOptional()
  @IsEnum(['PYG', 'USD'])
  currency?: CurrencyCode;

  @IsNumber()
  grantedAt!: number;

  @IsNumber()
  expiresAt!: number;

  @IsString()
  @IsNotEmpty()
  collectorId!: string;

  @IsString()
  @IsNotEmpty()
  collectorName!: string;

  @IsOptional()
  @IsBoolean()
  hasPagare?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocatable?: boolean;
}

export class RedirectLoanDto {
  @IsString()
  @IsNotEmpty()
  collectorId!: string;

  @IsString()
  @IsNotEmpty()
  collectorName!: string;
}

export class AnularLoanDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
