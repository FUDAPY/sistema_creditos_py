import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ClientReferenceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  workplace?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class ClientLocationDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  googleMapsUrl?: string;
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  documentId!: string;

  @IsOptional()
  @IsString()
  collectorId?: string;

  @IsOptional()
  @IsString()
  collectorName?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  address!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  housingType?: string;

  @IsOptional()
  @IsString()
  workplaceName?: string;

  @IsOptional()
  @IsString()
  workplaceAddress?: string;

  @IsOptional()
  @IsString()
  workplaceCity?: string;

  @IsOptional()
  @IsString()
  workplaceNeighborhood?: string;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsString()
  workPhone?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientReferenceDto)
  references?: ClientReferenceDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ClientLocationDto)
  location?: ClientLocationDto;
}

export class UpdateClientDataDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  housingType?: string;

  @IsOptional()
  @IsString()
  workplaceName?: string;

  @IsOptional()
  @IsString()
  workplaceAddress?: string;

  @IsOptional()
  @IsString()
  workplaceCity?: string;

  @IsOptional()
  @IsString()
  workplaceNeighborhood?: string;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsString()
  workPhone?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ClientLocationDto)
  location?: ClientLocationDto;
}

export class UpdateClientReferencesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientReferenceDto)
  references?: ClientReferenceDto[];
}

export class ReassignCollectorDto {
  @IsString()
  @IsNotEmpty()
  collectorId!: string;

  @IsString()
  @IsNotEmpty()
  collectorName!: string;
}
