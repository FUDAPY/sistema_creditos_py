import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePagareTomoDto {
  @IsString()
  @IsNotEmpty()
  tomo!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreatePagareDto {
  @IsOptional()
  @IsString()
  loanId?: string;

  @IsString()
  nombre!: string;

  @IsString()
  cedula!: string;

  @IsNumber()
  monto!: number;

  @IsString()
  @IsNotEmpty()
  tomo!: string;

  @IsOptional()
  @IsString()
  cobrador?: string;
}

export class TogglePagareStatusDto {
  @IsEnum(['activo', 'cancelado'])
  estado!: 'activo' | 'cancelado';
}

/** Asigna (o libera) el cobrador que tiene en su poder el pagaré. */
export class AssignPagareCollectorDto {
  @IsOptional()
  @IsString()
  collectorId?: string;

  @IsOptional()
  @IsString()
  cobrador?: string;
}

export class ImportPagaresDto {
  @IsString()
  @IsNotEmpty()
  csvText!: string;
}
