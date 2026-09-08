import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { PagaresModule } from './pagares/pagares.module';
import { LoansModule } from './loans/loans.module';
import { PaymentsModule } from './payments/payments.module';
import { CollectionModule } from './collection/collection.module';
import { SlotMachinesModule } from './slot-machines/slot-machines.module';
import { SpecialModule } from './special/special.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI', 'mongodb://localhost:27017/syscreditos'),
      }),
    }),
    AuditModule,
    UsersModule,
    AuthModule,
    ClientsModule,
    PagaresModule,
    LoansModule,
    PaymentsModule,
    CollectionModule,
    SlotMachinesModule,
    SpecialModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
