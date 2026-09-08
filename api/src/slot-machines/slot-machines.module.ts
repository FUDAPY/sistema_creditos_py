import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SlotMachineEntrySchema, SlotMachineSiteSchema } from './schemas/slot-machine.schema';
import { SlotMachinesService } from './slot-machines.service';
import { SlotMachinesController } from './slot-machines.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SlotMachineSite', schema: SlotMachineSiteSchema },
      { name: 'SlotMachineEntry', schema: SlotMachineEntrySchema },
    ]),
  ],
  controllers: [SlotMachinesController],
  providers: [SlotMachinesService],
  exports: [SlotMachinesService],
})
export class SlotMachinesModule {}
