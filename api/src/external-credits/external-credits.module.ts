import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExternalCreditSchema } from './schemas/external-credit.schema';
import { LoanSchema } from '../loans/schemas/loan.schema';
import { ExternalCreditsService } from './external-credits.service';
import { ExternalCreditsController } from './external-credits.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ExternalCredit', schema: ExternalCreditSchema },
      { name: 'Loan', schema: LoanSchema },
    ]),
    IntegrationsModule,
  ],
  controllers: [ExternalCreditsController],
  providers: [ExternalCreditsService],
  exports: [ExternalCreditsService],
})
export class ExternalCreditsModule {}
