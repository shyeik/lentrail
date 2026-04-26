/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║         LOAN PROFIT COMPUTATION ENGINE                    ║
 * ║  Supports: NEW | RENEWAL | EXTENSION | SUKLILOAN          ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * All monetary values → Philippine Peso (₱)
 * All outputs are Math.round()-ed (no decimals)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoanType = "NEW" | "RENEWAL" | "EXTENSION" | "SUKLILOAN";

/** Input for NEW or SUKLILOAN (identical computation) */
export interface NewLoanInput {
  loanType: "NEW" | "SUKLILOAN";
  /** Total months in this loan cycle (use totalMonths, fallback to loanTerm) */
  totalMonths: number;
  /** Agreed monthly amortization */
  monthlyAmort: number;
}

/** Input for RENEWAL */
export interface RenewalLoanInput {
  loanType: "RENEWAL";
  /** Months in the new renewal cycle */
  renewalMonths: number;
  /** New monthly amort for the renewal cycle */
  newMonthlyAmort: number;
  /** Months that were UNPAID in the OLD cycle */
  remainingMonthsNotPaid: number;
  /** Monthly amort of the OLD loan cycle */
  oldMonthlyAmort: number;
}

/** Input for EXTENSION */
export interface ExtensionLoanInput {
  loanType: "EXTENSION";
  /** Additional months being added */
  extensionMonths: number;
  /** Same monthly amort as the running loan */
  monthlyAmort: number;
  /** Actual cash handed to client (the "change" field from DB) */
  change: number;
}

export type LoanComputationInput =
  | NewLoanInput
  | RenewalLoanInput
  | ExtensionLoanInput;

// ── Output ────────────────────────────────────────────────────────────────────

export interface LoanComputationResult {
  loanType: LoanType;

  // ── Core figures ───────────────────────────────────────────
  /** months × monthlyAmort */
  principalLoan: number;
  /** principalLoan × 0.02 × months */
  interest: number;
  /** ₱60 × months */
  serviceFee: number;
  /** principalLoan × 0.0075 */
  docStamp: number;

  // ── Renewal-only ───────────────────────────────────────────
  /** remainingMonthsNotPaid × oldMonthlyAmort  (RENEWAL only, else 0) */
  oldRemainingBalance: number;
  /** ₱60 × remainingMonthsNotPaid             (RENEWAL only, else 0) */
  remainingServiceFee: number;

  // ── Final outputs ──────────────────────────────────────────
  /** Cash released to the client */
  netRelease: number;
  /** Company earnings from this transaction */
  revenue: number;

  // ── Breakdown helper (useful for UI) ──────────────────────
  totalDeductions: number;
}

// ── Engine ────────────────────────────────────────────────────────────────────

const r = Math.round;

/**
 * Compute loan profit figures for any loan type.
 *
 * @example
 * // NEW LOAN
 * computeLoanProfit({ loanType: "NEW", totalMonths: 12, monthlyAmort: 5000 })
 *
 * // RENEWAL
 * computeLoanProfit({
 *   loanType: "RENEWAL",
 *   renewalMonths: 12,
 *   newMonthlyAmort: 5500,
 *   remainingMonthsNotPaid: 3,
 *   oldMonthlyAmort: 5000,
 * })
 *
 * // EXTENSION
 * computeLoanProfit({
 *   loanType: "EXTENSION",
 *   extensionMonths: 6,
 *   monthlyAmort: 5000,
 *   change: 8500,
 * })
 */
export function computeLoanProfit(
  input: LoanComputationInput,
): LoanComputationResult {
  switch (input.loanType) {
    case "NEW":
    case "SUKLILOAN":
      return computeNewOrSukli(input);
    case "RENEWAL":
      return computeRenewal(input);
    case "EXTENSION":
      return computeExtension(input);
  }
}

// ── NEW / SUKLILOAN ───────────────────────────────────────────────────────────

function computeNewOrSukli(input: NewLoanInput): LoanComputationResult {
  const { loanType, totalMonths, monthlyAmort } = input;

  const principalLoan = r(totalMonths * monthlyAmort);
  const interest = r(principalLoan * 0.02 * totalMonths);
  const serviceFee = r(60 * totalMonths);
  const docStamp = r(principalLoan * 0.0075);

  const totalDeductions = interest + serviceFee + docStamp;
  const netRelease = r(principalLoan - totalDeductions);
  const revenue = r(interest + serviceFee + docStamp);

  return {
    loanType,
    principalLoan,
    interest,
    serviceFee,
    docStamp,
    oldRemainingBalance: 0,
    remainingServiceFee: 0,
    totalDeductions,
    netRelease,
    revenue,
  };
}

// ── RENEWAL ───────────────────────────────────────────────────────────────────

function computeRenewal(input: RenewalLoanInput): LoanComputationResult {
  const {
    renewalMonths,
    newMonthlyAmort,
    remainingMonthsNotPaid,
    oldMonthlyAmort,
  } = input;

  // Old loan residuals
  const oldRemainingBalance = r(remainingMonthsNotPaid * oldMonthlyAmort);
  const remainingServiceFee = r(60 * remainingMonthsNotPaid);

  // New cycle figures
  const principalLoan = r(renewalMonths * newMonthlyAmort);
  const interest = r(principalLoan * 0.02 * renewalMonths);
  const serviceFee = r(60 * renewalMonths);
  const docStamp = r(principalLoan * 0.0075);

  const totalDeductions =
    oldRemainingBalance +
    remainingServiceFee +
    interest +
    serviceFee +
    docStamp;

  const netRelease = r(principalLoan - totalDeductions);
  const revenue = r(interest + serviceFee + docStamp);

  return {
    loanType: "RENEWAL",
    principalLoan,
    interest,
    serviceFee,
    docStamp,
    oldRemainingBalance,
    remainingServiceFee,
    totalDeductions,
    netRelease,
    revenue,
  };
}

// ── EXTENSION ─────────────────────────────────────────────────────────────────

function computeExtension(input: ExtensionLoanInput): LoanComputationResult {
  const { extensionMonths, monthlyAmort, change } = input;

  const principalLoan = r(extensionMonths * monthlyAmort);
  const interest = r(principalLoan * 0.02 * extensionMonths);
  const serviceFee = r(60 * extensionMonths);
  const docStamp = r(principalLoan * 0.0075);

  const totalDeductions = interest + serviceFee + docStamp;

  // Extension: netRelease is the actual cash given (change field), NOT computed
  const netRelease = r(change);
  const revenue = r(interest + serviceFee + docStamp);

  return {
    loanType: "EXTENSION",
    principalLoan,
    interest,
    serviceFee,
    docStamp,
    oldRemainingBalance: 0,
    remainingServiceFee: 0,
    totalDeductions,
    netRelease,
    revenue,
  };
}

// ── Adapter: raw DB Transaction → computation input ───────────────────────────
//
// Use this when you have a raw Transaction object from your API and need
// to derive the computation input. You may need to pass in extra context
// (oldMonthlyAmort, remainingMonthsNotPaid) for RENEWAL.
//

export interface RawTransaction {
  loanType: LoanType;
  totalMonths?: number;
  loanTerm?: number;
  extensionMonths?: number;
  monthlyAmort?: number;
  change?: number;
  // Caller must provide these for RENEWAL (look up from previous transaction)
  remainingMonthsNotPaid?: number;
  oldMonthlyAmort?: number;
}

export function buildComputationInput(
  tx: RawTransaction,
): LoanComputationInput | null {
  const months = Number(tx.totalMonths || 0) || Number(tx.loanTerm || 0);
  const amort = Number(tx.monthlyAmort || 0);

  switch (tx.loanType) {
    case "NEW":
    case "SUKLILOAN":
      if (!months || !amort) return null;
      return {
        loanType: tx.loanType,
        totalMonths: months,
        monthlyAmort: amort,
      };

    case "RENEWAL":
      if (!months || !amort) return null;
      return {
        loanType: "RENEWAL",
        renewalMonths: months,
        newMonthlyAmort: amort,
        remainingMonthsNotPaid: Number(tx.remainingMonthsNotPaid || 0),
        oldMonthlyAmort: Number(tx.oldMonthlyAmort || 0),
      };

    case "EXTENSION": {
      const extMonths =
        Number(tx.extensionMonths || 0) || Number(tx.totalMonths || 0);
      if (!extMonths || !amort) return null;
      return {
        loanType: "EXTENSION",
        extensionMonths: extMonths,
        monthlyAmort: amort,
        change: Number(tx.change || 0),
      };
    }

    default:
      return null;
  }
}

// ── Batch helper ──────────────────────────────────────────────────────────────

export interface BatchResult {
  totalRevenue: number;
  totalNetRelease: number;
  totalPrincipal: number;
  totalInterest: number;
  totalServiceFee: number;
  totalDocStamp: number;
  byType: Record<
    LoanType,
    { count: number; revenue: number; netRelease: number }
  >;
  results: LoanComputationResult[];
}

export function computeBatch(inputs: LoanComputationInput[]): BatchResult {
  const results = inputs.map(computeLoanProfit);

  const byType = {} as BatchResult["byType"];
  const zero = () => ({ count: 0, revenue: 0, netRelease: 0 });

  let totalRevenue = 0;
  let totalNetRelease = 0;
  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalServiceFee = 0;
  let totalDocStamp = 0;

  for (const res of results) {
    if (!byType[res.loanType]) byType[res.loanType] = zero();
    byType[res.loanType].count += 1;
    byType[res.loanType].revenue += res.revenue;
    byType[res.loanType].netRelease += res.netRelease;

    totalRevenue += res.revenue;
    totalNetRelease += res.netRelease;
    totalPrincipal += res.principalLoan;
    totalInterest += res.interest;
    totalServiceFee += res.serviceFee;
    totalDocStamp += res.docStamp;
  }

  return {
    totalRevenue: r(totalRevenue),
    totalNetRelease: r(totalNetRelease),
    totalPrincipal: r(totalPrincipal),
    totalInterest: r(totalInterest),
    totalServiceFee: r(totalServiceFee),
    totalDocStamp: r(totalDocStamp),
    byType,
    results,
  };
}
