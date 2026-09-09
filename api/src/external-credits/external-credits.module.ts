import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExternalCreditSchema } from './schemas/external-credit.schema';
import { ExternalCreditsService } from './external-credits.service';
import { ExternalCreditsController } from './external-credits.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'ExternalCredit', schema: ExternalCreditSchema }]),
    IntegrationsModule,
  ],
  controllers: [ExternalCreditsController],
  providers: [ExternalCreditsService],
  exports: [ExternalCreditsService],
})
export class ExternalCreditsModule {}
