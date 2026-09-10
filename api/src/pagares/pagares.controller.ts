import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PagaresService } from './pagares.service';
import {
  AssignPagareCollectorDto,
  CreatePagareDto,
  CreatePagareTomoDto,
  ImportPagaresDto,
  TogglePagareStatusDto,
} from './dto/pagare.dto';
import { CurrentUser } from '../common/decorators';
import type { RequestUser } from '../common/types';

// Visible y utilizable por ADMIN y COBRADOR (sin @Roles): el cobrador necesita
// consultar tomos, tomar pagarés y entregarlos a su nombre.
@Controller('pagares')
export class PagaresController {
  constructor(private readonly pagaresService: PagaresService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.pagaresService.list(user.companyId);
  }

  @Get('resumen')
  resumen(@CurrentUser() user: RequestUser) {
    return this.pagaresService.resumen(user.companyId);
  }

  /** Cobradores activos para el selector de asignación (uid + nombre). */
  @Get('collectors')
  collectors(@CurrentUser() user: RequestUser) {
    return this.pagaresService.listCollectors(user.companyId);
  }

  @Get('available/:tomo')
  available(
    @CurrentUser() user: RequestUser,
    @Param('tomo') tomo: string,
  ): Promise<Record<string, unknown> | null> {
    return this.pagaresService.findAvailableInTomo(user.companyId, tomo);
  }

  @Post('tomo')
  createTomo(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePagareTomoDto,
  ): Promise<number> {
    return this.pagaresService.createTomo(user.companyId, dto.tomo, dto.cantidad, user.uid);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePagareDto,
  ): Promise<Record<string, unknown>> {
    return this.pagaresService.create(user.companyId, dto, user.uid);
  }

  @Post('import')
  importCsv(
    @CurrentUser() user: RequestUser,
    @Body() dto: ImportPagaresDto,
  ): Promise<{ importedCount: number; errorsCount: number }> {
    return this.pagaresService.importFromCsv(user.companyId, dto.csvText, user.uid);
  }

  @Patch(':id/status')
  async toggleStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: TogglePagareStatusDto,
  ): Promise<{ success: boolean }> {
    await this.pagaresService.toggleStatus(user.companyId, id, dto.estado, user);
    return { success: true };
  }

  /** Asigna (o libera con cobrador vacío) el pagaré a un cobrador. */
  @Patch(':id/cobrador')
  async assignCollector(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AssignPagareCollectorDto,
  ): Promise<{ success: boolean }> {
    await this.pagaresService.assignCollector(user.companyId, id, dto);
    return { success: true };
  }
}
