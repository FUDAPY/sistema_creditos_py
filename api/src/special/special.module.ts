import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoanSchema } from '../loans/schemas/loan.schema';
import { SpecialLoansService } from './special-loans.service';
import { PawnsController } from './pawns.controller';
import { RentalsController } from './rentals.controller';
import { ServicesController } from './services.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Loan', schema: LoanSchema }])],
  controllers: [PawnsController, RentalsController, ServicesController],
  providers: [SpecialLoansService],
  exports: [SpecialLoansService],
})
export class SpecialModule {}
