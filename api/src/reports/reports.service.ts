import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import type { Role } from '@syscreditos/shared';
import { calculateDaysLate } from '../loans/loan.utils';

export interface LoanDoc extends Document {
  companyId: string;
}

export interface PaymentDoc extends Document {
  companyId: string;
}

type CreditStatus = 'BUENO' | 'INFORCONF' | 'PREJUDICIAL' | 'JUDICIAL';
type CreditColor = 'green' | 'yellow' | 'orange' | 'red';

const creditInfo = (loan: {
  expiresAt?: number;
  nextDueDate?: number;
  inforconfConfirmedAt?: number;
  status?: string;
}): { daysLate: number; color: CreditColor; status: CreditStatus; label: string } => {
  const daysLate = calculateDaysLate({
    status: loan.status,
    expiresAt: loan.expiresAt,
    nextDueDate: loan.nextDueDate,
  });
  if (daysLate <= 30) {
    return {
      daysLate,
      color: 'green',
      status: 'BUENO',
      label: daysLate === 0 ? 'Al dia' : `${daysLate} dias de atraso`,
    };
  }
  if (!loan.inforconfConfirmedAt || daysLate <= 60) {
    return {
      daysLate,
      color: 'yellow',
      status: 'INFORCONF',
      label: !loan.inforconfConfirmedAt
        ? `${daysLate} dias de atraso (pendiente confirmar Inforconf)`
        : `${daysLate} dias de atraso`,
    };
  }
  if (daysLate <= 90) {
    return { daysLate, color: 'orange', status: 'PREJUDICIAL', label: `${daysLate} dias de atraso` };
  }
  return { daysLate, color: 'red', status: 'JUDICIAL', label: `${daysLate} dias de atraso` };
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel('Loan') private readonly loanModel: Model<LoanDoc>,
    @InjectModel('Payment') private readonly paymentModel: Model<PaymentDoc>,
  ) {}

  /** Cartera por cobrador con estado de credito (BUENO/INFORCONF/PREJUDICIAL/JUDICIAL). */
  async portfolio(
    companyId: string,
    role: Role,
    userId: string,
    filters: { collectorId?: string; loanType?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = {
      companyId,
      approvalStatus: 'APPROVED',
      status: { $in: ['ACTIVE', 'FROZEN', 'CONGELADO'] },
    };
    if (role !== 'ADMIN') query.collectorId = userId;
    else if (filters.collectorId) query.collectorId = filters.collectorId;
    if (filters.loanType) query.loanType = filters.loanType;

    const loans = await this.loanModel.find(query).exec();
    return loans.map((doc) => {
      const raw = (doc.toObject({ virtuals: false }) as unknown as Record<string, unknown>) ?? {};
      const info = creditInfo({
        expiresAt: raw.expiresAt as number | undefined,
        nextDueDate: raw.nextDueDate as number | undefined,
        inforconfConfirmedAt: raw.inforconfConfirmedAt as number | undefined,
        status: raw.status as string | undefined,
      });
      return {
        id: String(raw._id ?? ''),
        collectorId: raw.collectorId ?? '',
        collectorName: raw.collectorName ?? '',
        clientId: raw.clientId ?? '',
        clientName: raw.clientName ?? '',
        loanType: raw.loanType ?? '',
        principal: raw.principal ?? 0,
        currentBalance: raw.currentBalance ?? 0,
        paidAmount: raw.paidAmount ?? 0,
        totalAmount: raw.totalAmount ?? 0,
        expiresAt: raw.expiresAt ?? null,
        hasPagare: raw.hasPagare ?? false,
        ...info,
      };
    });
  }

  /**
   * Resumen del Consultor Recaudador por cobrador/periodo:
   * creditos dados, capital entregado, cobrado (aprobado), comisiones.
   */
  async consultorSummary(
    companyId: string,
    role: Role,
    userId: string,
    filters: { collectorId?: string; dateFrom?: number; dateTo?: number } = {},
  ): Promise<Record<string, unknown>[]> {
    const collectorId = role !== 'ADMIN' ? userId : filters.collectorId;

    const loanFilter: Record<string, unknown> = { companyId, approvalStatus: 'APPROVED' };
    const payFilter: Record<string, unknown> = {
      companyId,
      approvalStatus: 'APPROVED',
      estadoRendicion: { $ne: 'anulado' },
    };
    if (collectorId) {
      loanFilter.collectorId = collectorId;
      payFilter.collectorId = collectorId;
    }
    if (filters.dateFrom !== undefined || filters.dateTo !== undefined) {
      const range: Record<string, unknown> = {};
      if (filters.dateFrom !== undefined) range.$gte = filters.dateFrom;
      if (filters.dateTo !== undefined) range.$lte = filters.dateTo;
      payFilter.createdAt = range;
    }

    const [loans, payments] = await Promise.all([
      this.loanModel.find(loanFilter).exec(),
      this.paymentModel.find(payFilter).exec(),
    ]);

    const byCollector = new Map<string, Record<string, unknown>>();
    const ensure = (collectorKey: string, name: string) => {
      if (!byCollector.has(collectorKey)) {
        byCollector.set(collectorKey, {
          collectorId: collectorKey,
          collectorName: name,
          creditsGiven: 0,
          amountGiven: 0,
          loansActive: 0,
          amountCollected: 0,
          commissionsEarned: 0,
        });
      }
      return byCollector.get(collectorKey) as Record<string, unknown>;
    };

    for (const doc of loans) {
      const raw = (doc.toObject({ virtuals: false }) as unknown as Record<string, unknown>) ?? {};
      const key = String(raw.collectorId ?? 'sin-asignar');
      const row = ensure(key, String(raw.collectorName ?? key));
      row.creditsGiven = (row.creditsGiven as number) + 1;
      row.amountGiven = (row.amountGiven as number) + Number(raw.principal ?? 0);
      if (['ACTIVE', 'FROZEN', 'CONGELADO'].includes(String(raw.status))) {
        row.loansActive = (row.loansActive as number) + 1;
      }
    }

    for (const doc of payments) {
      const raw = (doc.toObject({ virtuals: false }) as unknown as Record<string, unknown>) ?? {};
      const key = String(raw.collectorId ?? 'sin-asignar');
      const row = ensure(key, String(raw.collectorName ?? key));
      row.amountCollected = (row.amountCollected as number) + Number(raw.amount ?? 0);
      row.commissionsEarned =
        (row.commissionsEarned as number) +
        Number(raw.commissionAmount ?? Math.round(Number(raw.amount ?? 0) * 0.07));
    }

    return Array.from(byCollector.values());
  }
}
