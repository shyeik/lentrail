import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

interface Transaction {
  _id: string;
  loanType: "NEW" | "EXTENSION" | "RENEWAL" | "SUKLILOAN";
  loanTerm?: number;
  extensionMonths?: number;
  totalMonths?: number;
  monthsPaid?: number;
  payments?: any[];
  dateOfLoan: string;
  startMonth: string;
  endMonth: string;
  pension: number;
  monthlyAmort: number;
  change: number;
  dsbNumber?: string;
}

type ComputedTransaction = Transaction & {
  cycle: number;
  computedTotalMonths: number;
  computedMonthsPaid: number;
  remainingMonths: number;
};

export default function LoanHistoryModal({
  open,
  onClose,
  client,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  client: any;
  onAdd: () => void;
}) {
  const token = localStorage.getItem("token");

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", client?._id],
    queryFn: async () => {
      const res = await axios.get(
        `${BACKEND_URL}/api/transactions/${client._id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return res.data as Transaction[];
    },
    enabled: !!client,
  });

  if (!open || !client) return null;

  const formatDate = (date?: string) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const toNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const calculateTotalMonths = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());

    if (end.getDate() >= start.getDate()) {
      months += 1;
    }

    return Math.max(0, months);
  };

  const calculateMonthsPaid = (cycleStartDate?: string) => {
    if (!cycleStartDate) return 0;

    const start = new Date(cycleStartDate);
    const today = new Date();

    if (Number.isNaN(start.getTime())) return 0;

    let months =
      (today.getFullYear() - start.getFullYear()) * 12 +
      (today.getMonth() - start.getMonth());

    if (today.getDate() >= start.getDate()) {
      months += 1;
    }

    return Math.max(0, months);
  };

  const sorted = [...(data || [])].sort(
    (a, b) =>
      new Date(a.dateOfLoan).getTime() - new Date(b.dateOfLoan).getTime(),
  );

  let cycle = 0;
  let cycleStartDate = "";
  let cycleTotalMonths = 0;
  let cycleMonthsPaid = 0;

  const computedTransactions: ComputedTransaction[] = sorted.map((t) => {
    const dateBasedTotalMonths = calculateTotalMonths(t.startMonth, t.endMonth);

    const baseLoanMonths =
      toNumber(t.loanTerm) || toNumber(t.totalMonths) || dateBasedTotalMonths;

    const extensionMonths =
      toNumber(t.extensionMonths) ||
      toNumber(t.totalMonths) ||
      dateBasedTotalMonths;

    if (t.loanType === "NEW" || t.loanType === "RENEWAL") {
      cycle += 1;
      cycleStartDate = t.startMonth;

      cycleTotalMonths = baseLoanMonths;
      cycleMonthsPaid = calculateMonthsPaid(cycleStartDate);
    }

    if (t.loanType === "EXTENSION") {
      cycleTotalMonths += extensionMonths;
      cycleMonthsPaid = calculateMonthsPaid(cycleStartDate);
    }

    const safeTotalMonths = Math.max(0, cycleTotalMonths);
    const safeMonthsPaid = Math.min(cycleMonthsPaid, safeTotalMonths);

    return {
      ...t,
      cycle,
      computedTotalMonths: safeTotalMonths,
      computedMonthsPaid: safeMonthsPaid,
      remainingMonths: Math.max(0, safeTotalMonths - safeMonthsPaid),
    };
  });

  const currentCycleTotalMonths =
    computedTransactions.length > 0
      ? computedTransactions[computedTransactions.length - 1]
          .computedTotalMonths
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full h-[90%] max-w-6xl bg-white shadow-xl rounded-sm overflow-hidden">
        <div className="h-1 bg-linear-to-r from-[#F4C430] via-[#e53935] to-[#F4C430]" />

        <div className="px-7 py-5 flex justify-between items-center border-b bg-[#F9FAFB]">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#e53935] font-semibold">
              Loan Records
            </p>

            <h2 className="text-lg font-bold text-[#111827] uppercase">
              {client.lastName}, {client.firstName}
            </h2>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onAdd}
              className="bg-[#111827] text-white px-4 py-2 text-xs rounded-sm"
            >
              + Add Transaction
            </button>

            <button
              onClick={onClose}
              className="px-3 py-2 text-xs border border-[#E5E7EB] rounded-sm"
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-8 py-3 border-b text-sm text-gray-500">
          Total months in current cycle:{" "}
          <span className="font-bold text-black">
            {currentCycleTotalMonths}
          </span>
        </div>

        <div className="p-8 overflow-auto h-full">
          {isLoading ? (
            <p className="text-xs text-gray-500">Loading...</p>
          ) : computedTransactions.length === 0 ? (
            <p className="text-xs text-gray-500">No loan records found.</p>
          ) : (
            <table className="w-full text-xs text-center">
              <thead>
                <tr className="bg-[#F9FAFB] border-b">
                  {[
                    "Date",
                    "Loan",
                    "DSB",
                    "Start",
                    "End",
                    "Pension",
                    "Amort",
                    "Change",
                    "Months",
                    "Remaining",
                    "Status",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {computedTransactions.map((t, i) => {
                  const monthsPaid = t.computedMonthsPaid;
                  const totalMonths = t.computedTotalMonths;
                  const remainingMonths = t.remainingMonths;

                  const canRenew =
                    totalMonths > 0 && monthsPaid >= totalMonths / 2;

                  const canExtend =
                    totalMonths > 0 && monthsPaid >= 3 && remainingMonths > 0;

                  const canSukli = toNumber(t.change) >= 1000;

                  const progress =
                    totalMonths > 0
                      ? Math.min((monthsPaid / totalMonths) * 100, 100)
                      : 0;

                  return (
                    <tr
                      key={t._id}
                      className={`border-b ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-2">{formatDate(t.dateOfLoan)}</td>

                      <td className="px-3 py-2">
                        <span className="px-2 py-1 text-[10px] bg-[#F4C430] rounded">
                          {t.loanType}
                        </span>
                      </td>

                      <td className="px-3 py-2">{t.dsbNumber || "-"}</td>
                      <td className="px-3 py-2">{formatDate(t.startMonth)}</td>
                      <td className="px-3 py-2">{formatDate(t.endMonth)}</td>
                      <td className="px-3 py-2">₱{toNumber(t.pension)}</td>
                      <td className="px-3 py-2">₱{toNumber(t.monthlyAmort)}</td>
                      <td className="px-3 py-2">₱{toNumber(t.change)}</td>

                      <td className="px-3 py-2 w-40">
                        <div className="text-xs font-semibold mb-1">
                          {monthsPaid}
                          <span className="text-gray-400">
                            {" "}
                            / {totalMonths}
                          </span>
                        </div>

                        <div className="w-full bg-gray-200 h-1 rounded">
                          <div
                            className="bg-green-500 h-1 rounded"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-3 py-2 font-semibold">
                        {remainingMonths}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {canRenew && (
                            <span className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 rounded">
                              Renewal
                            </span>
                          )}

                          {canExtend && (
                            <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded">
                              Extension
                            </span>
                          )}

                          {canSukli && (
                            <span className="px-2 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded">
                              Sukli
                            </span>
                          )}

                          {!canRenew && !canExtend && !canSukli && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
