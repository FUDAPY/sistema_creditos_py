import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoanSchema } from '../loans/schemas/loan.schema';
import { PaymentSchema } from '../payments/schemas/payment.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Loan', schema: LoanSchema },
      { name: 'Payment', schema: PaymentSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
