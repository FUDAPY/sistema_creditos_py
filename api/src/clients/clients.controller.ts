import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import {
  CreateClientDto,
  UpdateClientDataDto,
  UpdateClientReferencesDto,
  ReassignCollectorDto,
} from './dto/client.dto';
import { CurrentUser, Roles } from '../common/decorators';
import type { RequestUser } from '../common/types';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.clientsService.list(user.companyId);
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    const client = await this.clientsService.getById(user.companyId, id);
    if (!client) throw new NotFoundException('Cliente no encontrado.');
    return client;
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateClientDto,
  ): Promise<Record<string, unknown>> {
    return this.clientsService.create(user.companyId, dto, user);
  }

  @Patch(':id')
  updateData(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDataDto,
  ): Promise<Record<string, unknown>> {
    return this.clientsService.updateData(user.companyId, id, dto, user);
  }

  @Patch(':id/references')
  updateReferences(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientReferencesDto,
  ): Promise<Record<string, unknown>> {
    return this.clientsService.updateReferences(user.companyId, id, dto, user);
  }

  @Roles('ADMIN')
  @HttpCode(204)
  @Post(':id/reassign')
  async reassignCollector(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReassignCollectorDto,
  ): Promise<void> {
    await this.clientsService.reassignCollector(user.companyId, id, dto, user);
  }
}
