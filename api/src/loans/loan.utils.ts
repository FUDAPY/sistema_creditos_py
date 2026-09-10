/**
 * Reglas de negocio de creditos (replicadas 1:1 del sistema Firestore original).
 * Los importes se redondean con Math.round y las fechas se comparan por dia UTC.
 */
import type { Loan, LoanType } from '@syscreditos/shared';

const DAY_MS = 1000 * 60 * 60 * 24;
export const DEFAULT_INTEREST_RATE = 20;
export const DEFAULT_CYCLE_DAYS = 30;
/** Dias de gracia antes de que comience a generar mora (cobro punitorio diario). */
export const MORA_GRACE_DAYS = 5;

export interface LoanLike {
  principal: number;
  interestRate: number;
  loanType?: LoanType;
  status?: unknown;
  approvalStatus?: unknown;
}

export const normalizePrincipalBalance = (loan: { currentBalance?: number; principal?: number }) =>
  Math.max(0, Math.min(loan.currentBalance || 0, loan.principal || 0));

export const startOfUtcDay = (timestamp: number) => {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

export const getLoanCycleDays = (
  loan: { cycleDays?: number; grantedAt?: number; expiresAt?: number },
): number => {
  if (loan.cycleDays && loan.cycleDays > 0) return loan.cycleDays;
  const derived = Math.round(((loan.expiresAt || 0) - (loan.grantedAt || 0)) / DAY_MS);
  return derived > 0 ? derived : DEFAULT_CYCLE_DAYS;
};

/** Tipos que NO generan interés ni mora (se cobra solo capital / monto fijo). */
export const NO_INTEREST_LOAN_TYPES: LoanType[] = [
  'CELULAR',
  'ALQUILER_INMUEBLE',
  'PRESTACION_SERVICIOS',
];

export const loanTypeUsesInitialInterest = (loanType?: LoanType) =>
  loanType !== 'ALQUILER_INMUEBLE' &&
  loanType !== 'PRESTACION_SERVICIOS' &&
  loanType !== 'CONGELADO' &&
  loanType !== 'CELULAR';

export const loanTypeStartsFrozen = (loanType?: LoanType) => loanType === 'PRESTACION_SERVICIOS';

/**
 * Tasa de interes por cantidad de cuotas para CREDITOS NUEVOS a plazos.
 * 6 cuotas -> 20% | 12 cuotas -> 20% | 18 cuotas -> 25% | 24 cuotas -> 30%
 * Cualquier otro valor (o credito sin cuotas) usa el default historico de 20%.
 */
export const INTEREST_RATE_BY_CUOTAS: Record<number, number> = {
  6: 20,
  12: 20,
  18: 25,
  24: 30,
};

export interface InterestRateInput {
  interestRate?: number | null;
  cantidadCuotas?: number | null;
  loanType?: LoanType | null;
}

export const resolveInterestRate = (input: InterestRateInput): number => {
  // Celular / Alquiler / Prestación: SIEMPRE 0% (solo el monto).
  if (input.loanType && NO_INTEREST_LOAN_TYPES.includes(input.loanType)) return 0;
  if (input.cantidadCuotas && INTEREST_RATE_BY_CUOTAS[input.cantidadCuotas] !== undefined) {
    return INTEREST_RATE_BY_CUOTAS[input.cantidadCuotas];
  }
  if (input.interestRate !== undefined && input.interestRate !== null && input.interestRate >= 0) {
    return input.interestRate;
  }
  return DEFAULT_INTEREST_RATE;
};


export const isFrozenLoan = (loan: { loanType?: LoanType; status?: unknown }) =>
  loan.status === 'FROZEN' || loan.status === 'CONGELADO' || loan.loanType === 'CONGELADO';

export const isStandardCredit = (loan: { loanType?: LoanType; status?: unknown }) =>
  loan.loanType === 'PRESTAMO' &&
  loan.status !== 'FROZEN' &&
  loan.status !== 'CONGELADO';

export const calculateInterestAmount = (loan: LoanLike): number => {
  if (!loanTypeUsesInitialInterest(loan.loanType) || isFrozenLoan(loan)) return 0;
  const rate = loan.interestRate >= 0 ? loan.interestRate : DEFAULT_INTEREST_RATE;
  return Math.round(loan.principal * (rate / 100));
};

export const calculateDaysLate = (
  loan: {
    status?: unknown;
    approvalStatus?: unknown;
    expiresAt?: number;
    nextDueDate?: number;
  },
  referenceTime = Date.now(),
): number => {
  if (
    isFrozenLoan(loan) ||
    loan.status === 'PAID' ||
    (loan.approvalStatus && loan.approvalStatus !== 'APPROVED')
  ) {
    return 0;
  }
  const referenceDay = startOfUtcDay(referenceTime);
  const dueDay = startOfUtcDay(loan.nextDueDate || loan.expiresAt || referenceTime);
  if (referenceDay <= dueDay) return 0;
  const lateDays = Math.floor((referenceDay - dueDay) / DAY_MS);
  // 5 dias de gracia exactos: el punitorio diario recien aplica a partir del dia 6.
  return Math.max(0, lateDays - MORA_GRACE_DAYS);
};

export interface AccruedState {
  principalBalance: number;
  accruedInterestBalance: number;
  accruedLateFeeBalance: number;
  nextDueDate: number;
  currentDueDate: number;
  lastAccruedAt: number;
  chargedCycles: number;
  interestPerCycle: number;
}

export interface AccruedInput {
  principal?: number;
  interestRate?: number;
  loanType?: LoanType;
  status?: unknown;
  approvalStatus?: unknown;
  currentBalance?: number;
  interestPaidAmount?: number;
  paidAmount?: number;
  cycleDays?: number;
  grantedAt?: number;
  expiresAt?: number;
  nextDueDate?: number;
  lastAccruedAt?: number;
}

/** Recalcula saldos devengados de un credito (misma logica que el sistema original). */
export const accrueLoanState = (loan: AccruedInput, referenceTime = Date.now()): AccruedState => {
  const principalBalance = normalizePrincipalBalance(loan);
  const principal = loan.principal ?? 0;
  const interestRate = loan.interestRate ?? DEFAULT_INTEREST_RATE;
  const interestPerCycle = calculateInterestAmount({
    principal,
    interestRate,
    loanType: loan.loanType,
    status: loan.status,
  });
  const currentDueDate = loan.nextDueDate || loan.expiresAt || referenceTime;
  const daysLate = calculateDaysLate(loan, referenceTime);
  const cycleDays = getLoanCycleDays(loan);
  const cyclesElapsed =
    isStandardCredit(loan) && referenceTime >= currentDueDate
      ? Math.floor(
          (startOfUtcDay(referenceTime) - startOfUtcDay(currentDueDate)) / (cycleDays * DAY_MS),
        ) + 1
      : 0;
  const dailyInterest = isStandardCredit(loan) ? interestPerCycle / 30 : 0;
  const overdueInterestCharged = Math.round(dailyInterest * daysLate);
  const interestPaidAmount = Math.max(0, loan.interestPaidAmount || 0);
  const overdueInterestPaid = Math.min(interestPaidAmount, overdueInterestCharged);
  const initialInterestPaid = Math.max(0, interestPaidAmount - overdueInterestPaid);
  const accruedLateFeeBalance = Math.max(0, overdueInterestCharged - overdueInterestPaid);
  const recurringInterest = isStandardCredit(loan) ? interestPerCycle * cyclesElapsed : 0;
  const accruedInterestBalance =
    principalBalance > 0 ? Math.max(0, interestPerCycle + recurringInterest - initialInterestPaid) : 0;

  const frozen =
    isFrozenLoan(loan) ||
    loan.status === 'PAID' ||
    (loan.approvalStatus && loan.approvalStatus !== 'APPROVED');

  return {
    principalBalance,
    accruedInterestBalance,
    accruedLateFeeBalance,
    nextDueDate: loan.expiresAt || referenceTime,
    currentDueDate,
    lastAccruedAt: frozen ? loan.lastAccruedAt || loan.expiresAt || referenceTime : referenceTime,
    chargedCycles: cyclesElapsed,
    interestPerCycle,
  };
};

