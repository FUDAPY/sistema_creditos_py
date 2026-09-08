import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/types';
import type {
  CreateClientDto,
  UpdateClientDataDto,
  UpdateClientReferencesDto,
  ReassignCollectorDto,
} from './dto/client.dto';

export interface ClientDoc extends Document {
  companyId: string;
  fullName: string;
  fullNameLower?: string;
  documentId: string;
  documentSearch?: string;
  collectorId?: string;
  collectorName?: string;
  phone: string;
  phoneSearch?: string;
  email?: string;
  address: string;
  city: string;
  references?: unknown[];
  location?: unknown;
  createdAt?: number;
  updatedAt?: number;
}

export interface LoanLikeDoc extends Document {
  companyId: string;
  clientId: string;
  status?: string;
}

const normalizeSearchText = (value?: string) => (value || '').trim().toLocaleLowerCase('es');
const normalizeDigits = (value?: string) => (value || '').replace(/\D/g, '');

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel('Client') private readonly clientModel: Model<ClientDoc>,
    @InjectModel('Loan') private readonly loanModel: Model<LoanLikeDoc>,
    private readonly audit: AuditService,
  ) {}

  toPublic(doc: ClientDoc): Record<string, unknown> {
    const raw = doc.toObject({ virtuals: false });
    return { ...raw, id: String((raw as Record<string, unknown>)._id ?? doc.id ?? '') };
  }

  async list(companyId: string): Promise<Record<string, unknown>[]> {
    const docs = await this.clientModel
      .find({ companyId })
      .collation({ locale: 'es' })
      .sort({ fullName: 1 })
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async getById(companyId: string, clientId: string): Promise<Record<string, unknown> | null> {
    const doc = await this.clientModel.findOne({ _id: clientId, companyId }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async create(
    companyId: string,
    data: CreateClientDto,
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const now = Date.now();
    const fullName = data.fullName.trim();
    const documentId = data.documentId.trim();
    const phone = (data.phone || '').trim();
    const clientId = randomUUID();
    const doc = await this.clientModel.create({
      _id: clientId,
      id: clientId,
      companyId,
      ...data,
      fullName,
      fullNameLower: normalizeSearchText(fullName),
      documentId,
      documentSearch: normalizeDigits(documentId),
      phone,
      phoneSearch: normalizeDigits(phone),
      references: data.references || [],
      location: data.location || {},
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
    });
    await this.audit.log({
      action: 'CREATE_CLIENT',
      entity: 'CLIENT',
      entityId: clientId,
      details: { fullName, documentId, phone },
      actor,
    });
    return this.toPublic(doc);
  }

  async updateData(
    companyId: string,
    clientId: string,
    data: UpdateClientDataDto,
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const existing = await this.clientModel.findOne({ _id: clientId, companyId }).exec();
    if (!existing) throw new NotFoundException('Cliente no encontrado.');

    const now = Date.now();
    const fullName = data.fullName?.trim() ?? existing.fullName ?? '';
    const documentId = data.documentId?.trim() ?? existing.documentId ?? '';
    const phone = data.phone?.trim() ?? existing.phone ?? '';
    const references = (existing.references ?? []) as ClientDoc['references'];

    const payload: Record<string, unknown> = {
      fullName,
      fullNameLower: normalizeSearchText(fullName),
      documentId,
      documentSearch: normalizeDigits(documentId),
      birthDate: data.birthDate?.trim() || '',
      nationality: data.nationality?.trim() || '',
      phone,
      phoneSearch: normalizeDigits(phone),
      email: data.email?.trim() || '',
      address: data.address?.trim() || '',
      city: data.city?.trim() || '',
      neighborhood: data.neighborhood?.trim() || '',
      housingType: data.housingType || 'PROPIA',
      workplaceName: data.workplaceName?.trim() || '',
      workplaceAddress: data.workplaceAddress?.trim() || '',
      workplaceCity: data.workplaceCity?.trim() || '',
      workplaceNeighborhood: data.workplaceNeighborhood?.trim() || '',
      seniority: data.seniority?.trim() || '',
      employmentStatus: data.employmentStatus || 'EMPLEADO',
      workPhone: data.workPhone?.trim() || '',
      position: data.position?.trim() || '',
      department: data.department?.trim() || '',
      references,
      location: {
        latitude: Number(data.location?.latitude || 0),
        longitude: Number(data.location?.longitude || 0),
        googleMapsUrl: data.location?.googleMapsUrl?.trim() || '',
      },
      updatedAt: now,
    };

    await this.clientModel.updateOne({ _id: clientId, companyId }, { $set: payload }).exec();
    // Propagacion de datos desnormalizados a los creditos del cliente
    await this.loanModel
      .updateMany(
        { companyId, clientId },
        {
          $set: {
            clientName: fullName,
            clientNameLower: normalizeSearchText(fullName),
            clientDocumentId: documentId,
            clientPhone: phone,
            clientAddress: String(payload.address),
            updatedAt: now,
          },
        },
      )
      .exec();

    await this.audit.log({
      action: 'UPDATE_CLIENT_DATA',
      entity: 'CLIENT',
      entityId: clientId,
      details: { fullName, documentId, phone },
      actor,
    });

    const updated = await this.clientModel.findOne({ _id: clientId, companyId }).exec();
    return this.toPublic(updated as ClientDoc);
  }

  async updateReferences(
    companyId: string,
    clientId: string,
    data: UpdateClientReferencesDto,
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const references = (data.references || []).map((reference) => ({
      name: reference.name?.trim() ?? '',
      relationship: reference.relationship?.trim() ?? '',
      workplace: reference.workplace?.trim() ?? '',
      phone: reference.phone?.trim() ?? '',
    }));
    const res = await this.clientModel
      .updateOne(
        { _id: clientId, companyId },
        { $set: { references, updatedAt: Date.now() } },
      )
      .exec();
    if (res.matchedCount === 0) throw new NotFoundException('Cliente no encontrado.');

    await this.audit.log({
      action: 'UPDATE_CLIENT_REFERENCES',
      entity: 'CLIENT',
      entityId: clientId,
      details: { referencesCount: references.length },
      actor,
    });
    const updated = await this.clientModel.findOne({ _id: clientId, companyId }).exec();
    return this.toPublic(updated as ClientDoc);
  }

  async reassignCollector(
    companyId: string,
    clientId: string,
    data: ReassignCollectorDto,
    actor: RequestUser,
  ): Promise<void> {
    const now = Date.now();
    const { collectorId, collectorName } = data;
    const clientRes = await this.clientModel
      .updateOne(
        { _id: clientId, companyId },
        { $set: { collectorId, collectorName, updatedAt: now } },
      )
      .exec();
    if (clientRes.matchedCount === 0) throw new NotFoundException('Cliente no encontrado.');

    await this.loanModel
      .updateMany(
        { companyId, clientId, status: { $ne: 'PAID' } },
        { $set: { collectorId, collectorName, updatedAt: now } },
      )
      .exec();

    await this.audit.log({
      action: 'REASSIGN_CLIENT',
      entity: 'CLIENT',
      entityId: clientId,
      details: { collectorId, collectorName },
      actor,
    });
  }
}
