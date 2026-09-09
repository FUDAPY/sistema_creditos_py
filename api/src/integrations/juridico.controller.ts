import { Controller, Get } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import type { JuridicoCreditoView } from './juridico.connector';

/**
 * Lectura de creditos del sistema juridico (lin-group-central).
 * Accesible a cualquier usuario autenticado para alimentar la vista
 * "Empresas -> Juridico". La conexion es SOLO-LECTURA contra su MongoDB.
 */
@Controller('integrations/juridico')
export class JuridicoController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('creditos')
  creditos(): Promise<JuridicoCreditoView[]> {
    return this.integrationsService.juridicoCreditos();
  }
}
