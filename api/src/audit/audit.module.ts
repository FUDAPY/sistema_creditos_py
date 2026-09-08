import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogSchema } from './schemas/audit-log.schema';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: 'AuditLog', schema: AuditLogSchema }])],
  providers: [AuditService],
  exports: [AuditService, MongooseModule],
})
export class AuditModule {}
