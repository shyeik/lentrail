export type LoanType = "NEW" | "EXTENSION" | "RENEWAL";

interface ComputeTotalMonthsParams {
  loanType: LoanType;
  loanTerm?: number; // for NEW / RENEWAL
  extensionMonths?: number; // for EXTENSION
  previousTotalMonths?: number;
}

export const computeTotalMonths = ({
  loanType,
  loanTerm = 0,
  extensionMonths = 0,
  previousTotalMonths = 0,
}: ComputeTotalMonthsParams): number => {
  switch (loanType) {
    case "NEW":
      return loanTerm;

    case "EXTENSION":
      return previousTotalMonths + extensionMonths;

    case "RENEWAL":
      return loanTerm; // ✅ RESET

    default:
      return 0;
  }
};
