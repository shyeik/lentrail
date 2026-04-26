// /components/ComputeLoanModal.tsx

import { useState } from "react";
import { computeLoanDetails } from "../utils/loanUtils";

export default function ComputeLoanModal({
  open,
  onClose,
  client,
  eligibleMonths,
}: any) {
  const [monthlyKaltas, setMonthlyKaltas] = useState("");
  const [result, setResult] = useState<any>(null);

  if (!open || !client) return null;

  const handleCompute = () => {
    const kaltas = Number(monthlyKaltas);

    if (!kaltas || !eligibleMonths) return;

    const res = computeLoanDetails({
      monthlyKaltas: kaltas,
      loanTerm: eligibleMonths,
    });

    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white rounded-sm shadow-xl">
        {/* Header */}
        <div className="p-4 border-b font-bold">Loan Computation</div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="text-sm">
            <p>
              <b>Client:</b> {client.lastName}
            </p>
            <p>
              <b>Eligible Months:</b> {eligibleMonths}
            </p>
          </div>

          <input
            type="number"
            placeholder="Monthly Kaltas"
            className="w-full border px-3 py-2 text-sm"
            onChange={(e) => setMonthlyKaltas(e.target.value)}
          />

          <button
            onClick={handleCompute}
            className="w-full bg-black text-white py-2 text-sm"
          >
            Compute
          </button>

          {result && (
            <div className="grid grid-cols-2 gap-2 text-xs mt-3">
              <div>Loan</div>
              <div>₱{result.principalLoan}</div>

              <div>Interest</div>
              <div>₱{result.interest}</div>

              <div>Service Fee</div>
              <div>₱{result.serviceFee}</div>

              <div>Doc Stamp</div>
              <div>₱{result.docstamp}</div>

              <div>Net Take Home</div>
              <div className="font-bold text-green-600">
                ₱{result.netTakeHome}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-right">
          <button onClick={onClose} className="text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
