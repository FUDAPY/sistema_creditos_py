import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/types';

export interface LoanDoc extends Document {
  companyId: string;
  status?: string;
  loanType?: string;
  expiresAt?: number;
  paidAt?: number;
  paidCycles?: number;
  serviceDeliveredAt?: number;
  completedAt?: number;
  description?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SpecialLoansService {
  constructor(
    @InjectModel('Loan') private readonly loanModel: Model<LoanDoc>,
    private readonly audit: AuditService,
  ) {}

  toPublic(doc: LoanDoc): Record<string, unknown> {
    const raw = (doc.toObject({ virtuals: false }) as unknown as Record<string, unknown>) ?? {};
    return { ...raw, id: String(raw._id ?? '') };
  }

  private async requireLoan(
    companyId: string,
    loanId: string,
    expectedType?: string,
  ): Promise<LoanDoc> {
    const loan = await this.loanModel.findOne({ _id: loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('Registro no encontrado.');
    if (expectedType && loan.loanType !== expectedType) {
      throw new NotFoundException(`El registro no es de tipo ${expectedType}.`);
    }
    return loan;
  }

  async listByType(
    companyId: string,
    loanType: string,
  ): Promise<Record<string, unknown>[]> {
    const docs = await this.loanModel
      .find({
        companyId,
        loanType,
        status: { $in: ['ACTIVE', 'FROZEN', 'CONGELADO'] },
      })
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async getById(companyId: string, id: string, loanType: string): Promise<Record<string, unknown>> {
    const loan = await this.requireLoan(companyId, id, loanType);
    return this.toPublic(loan);
  }

  // ── Empeños ──────────────────────────────────────────────
  async redeemPawn(companyId: string, pawnId: string, actor: RequestUser): Promise<void> {
    const pawn = await this.requireLoan(companyId, pawnId, 'EMPENO');
    if (pawn.status === 'PAID') {
      throw new BadRequestException('Este empeño ya fue rescatado.');
    }
    const now = Date.now();
    await this.loanModel
      .updateOne({ _id: pawnId, companyId }, { $set: { status: 'PAID', paidAt: now, updatedAt: now } })
      .exec();
    await this.audit.log({
      action: 'PAWN_REDEEMED',
      entity: 'PAWN',
      entityId: pawnId,
      details: { reason: 'Redemption' },
      actor,
    });
  }

  async extendPawn(
    companyId: string,
    pawnId: string,
    extensionDays: number,
    actor: RequestUser,
  ): Promise<void> {
    const pawn = await this.requireLoan(companyId, pawnId, 'EMPENO');
    const newExpiresAt = (pawn.expiresAt || Date.now()) + extensionDays * DAY_MS;
    await this.loanModel
      .updateOne({ _id: pawnId, companyId }, { $set: { expiresAt: newExpiresAt, updatedAt: Date.now() } })
      .exec();
    await this.audit.log({
      action: 'PAWN_EXTENDED',
      entity: 'PAWN',
      entityId: pawnId,
      details: { extensionDays, newExpiresAt },
      actor,
    });
  }

  // ── Alquileres ────────────────────────────────────────────
  async renewRental(
    companyId: string,
    rentalId: string,
    renewalMonths: number,
    actor: RequestUser,
  ): Promise<void> {
    const rental = await this.requireLoan(companyId, rentalId, 'ALQUILER_INMUEBLE');
    if (rental.status === 'PAID') {
      throw new BadRequestException('Este alquiler ya fue completado.');
    }
    const currentExpiry = new Date(rental.expiresAt || Date.now());
    const newExpiry = new Date(currentExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + renewalMonths);
    const newExpiresAt = newExpiry.getTime();
    await this.loanModel
      .updateOne({ _id: rentalId, companyId }, { $set: { expiresAt: newExpiresAt, updatedAt: Date.now() } })
      .exec();
    await this.audit.log({
      action: 'RENTAL_RENEWED',
      entity: 'RENTAL',
      entityId: rentalId,
      details: { renewalMonths, newExpiresAt },
      actor,
    });
  }

  async recordRentalPayment(
    companyId: string,
    rentalId: string,
    periodMonthCount: number,
    actor: RequestUser,
  ): Promise<void> {
    const rental = await this.requireLoan(companyId, rentalId, 'ALQUILER_INMUEBLE');
    const paidCycles = (rental.paidCycles || 0) + periodMonthCount;
    await this.loanModel
      .updateOne({ _id: rentalId, companyId }, { $set: { paidCycles, updatedAt: Date.now() } })
      .exec();
    await this.audit.log({
      action: 'RENTAL_PAYMENT_RECORDED',
      entity: 'RENTAL',
      entityId: rentalId,
      details: { periodMonthCount },
      actor,
    });
  }

  async terminateRental(companyId: string, rentalId: string, actor: RequestUser): Promise<void> {
    await this.requireLoan(companyId, rentalId, 'ALQUILER_INMUEBLE');
    const now = Date.now();
    await this.loanModel
      .updateOne(
        { _id: rentalId, companyId },
        { $set: { status: 'PAID', terminatedAt: now, updatedAt: now } },
      )
      .exec();
    await this.audit.log({
      action: 'RENTAL_TERMINATED',
      entity: 'RENTAL',
      entityId: rentalId,
      details: {},
      actor,
    });
  }

  // ── Prestación de servicios ───────────────────────────────
  async recordServiceDelivery(
    companyId: string,
    serviceId: string,
    deliveryDate: number,
    actor: RequestUser,
  ): Promise<void> {
    const service = await this.requireLoan(companyId, serviceId, 'PRESTACION_SERVICIOS');
    if (service.status === 'PAID') {
      throw new BadRequestException('Este servicio ya fue completado.');
    }
    await this.loanModel
      .updateOne(
        { _id: serviceId, companyId },
        { $set: { serviceDeliveredAt: deliveryDate, updatedAt: Date.now() } },
      )
      .exec();
    await this.audit.log({
      action: 'SERVICE_DELIVERED',
      entity: 'SERVICE',
      entityId: serviceId,
      details: { deliveryDate },
      actor,
    });
  }

  async completeService(companyId: string, serviceId: string, actor: RequestUser): Promise<void> {
    await this.requireLoan(companyId, serviceId, 'PRESTACION_SERVICIOS');
    const now = Date.now();
    await this.loanModel
      .updateOne(
        { _id: serviceId, companyId },
        { $set: { status: 'PAID', completedAt: now, updatedAt: now } },
      )
      .exec();
    await this.audit.log({
      action: 'SERVICE_COMPLETED',
      entity: 'SERVICE',
      entityId: serviceId,
      details: {},
      actor,
    });
  }

  async updateServiceDescription(
    companyId: string,
    serviceId: string,
    description: string,
    actor: RequestUser,
  ): Promise<void> {
    await this.requireLoan(companyId, serviceId, 'PRESTACION_SERVICIOS');
    await this.loanModel
      .updateOne(
        { _id: serviceId, companyId },
        { $set: { description, updatedAt: Date.now() } },
      )
      .exec();
    await this.audit.log({
      action: 'SERVICE_DESCRIPTION_UPDATED',
      entity: 'SERVICE',
      entityId: serviceId,
      details: { description },
      actor,
    });
  }
}