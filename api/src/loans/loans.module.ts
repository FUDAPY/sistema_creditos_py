import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoanSchema } from './schemas/loan.schema';
import { ClientSchema } from '../clients/schemas/client.schema';
import { PagareSchema } from '../pagares/schemas/pagare.schema';
import { PaymentSchema } from '../payments/schemas/payment.schema';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Loan', schema: LoanSchema },
      { name: 'Client', schema: ClientSchema },
      { name: 'Pagare', schema: PagareSchema },
      { name: 'Payment', schema: PaymentSchema },
    ]),
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
