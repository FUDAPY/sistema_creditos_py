import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollectionManagementSchema } from './schemas/collection-management.schema';
import { PaymentDayLockSchema } from './schemas/payment-day-lock.schema';
import { LoanSchema } from '../loans/schemas/loan.schema';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CollectionManagement', schema: CollectionManagementSchema },
      { name: 'PaymentDayLock', schema: PaymentDayLockSchema },
      { name: 'Loan', schema: LoanSchema },
    ]),
  ],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
