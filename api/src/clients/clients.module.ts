import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientSchema } from './schemas/client.schema';
import { LoanSchema } from '../loans/schemas/loan.schema';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Client', schema: ClientSchema },
      { name: 'Loan', schema: LoanSchema },
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
