// /utils/loanUtils.ts

export const computeEligibleMonths = (age: number): number => {
  if (age < 60) return 0;

  if (age <= 72) return 24;

  const excessYears = age - 72;
  const deduction = excessYears * 2;

  return Math.max(24 - deduction, 0);
};

export const computeLoanDetails = ({
  monthlyKaltas,
  loanTerm,
}: {
  monthlyKaltas: number;
  loanTerm: number;
}) => {
  const principalLoan = monthlyKaltas * loanTerm;
  const interest = loanTerm * 0.02 * principalLoan;
  const serviceFee = 60 * loanTerm;
  const docstamp = principalLoan * 0.0075;
  const processingFee = 290;

  const totalDeduction = serviceFee + docstamp + processingFee + interest;

  const netTakeHome = principalLoan - totalDeduction;

  return {
    principalLoan,
    interest,
    serviceFee,
    docstamp,
    processingFee,
    totalDeduction,
    netTakeHome,
  };
};
