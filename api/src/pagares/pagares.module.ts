import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PagareSchema } from './schemas/pagare.schema';
import { PagaresService } from './pagares.service';
import { PagaresController } from './pagares.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Pagare', schema: PagareSchema }])],
  controllers: [PagaresController],
  providers: [PagaresService],
  exports: [PagaresService],
})
export class PagaresModule {}
