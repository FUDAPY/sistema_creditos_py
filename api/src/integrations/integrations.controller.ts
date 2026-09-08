import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import type { IntegrationStatus, IntegrationSystem } from './integrations.types';
import { Roles } from '../common/decorators';

const VALID_SYSTEMS: IntegrationSystem[] = ['pos', 'juridico', 'financiero'];

@Controller('integrations')
@Roles('ADMIN')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('status')
  status(): IntegrationStatus[] {
    return this.integrationsService.statuses();
  }

  @Post(':system/sync')
  sync(
    @Param('system') system: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _body: Record<string, unknown>,
  ): Promise<{ system: IntegrationSystem; ran: boolean }> {
    const normalized = system as IntegrationSystem;
    if (!VALID_SYSTEMS.includes(normalized)) {
      throw new Error('Sistema de integracion no valido.');
    }
    return this.integrationsService.runSync(normalized);
  }
}
