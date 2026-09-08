import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './common/decorators';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  check() {
    const mongoUp = this.connection.readyState === 1;
    return {
      status: mongoUp ? 'ok' : 'degraded',
      service: 'syscreditos-api',
      mongo: mongoUp ? 'up' : 'down',
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
  }
}

