import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PagaresService } from './pagares.service';
import {
  CreatePagareDto,
  CreatePagareTomoDto,
  ImportPagaresDto,
  TogglePagareStatusDto,
} from './dto/pagare.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('pagares')
@Roles('ADMIN')
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
}
