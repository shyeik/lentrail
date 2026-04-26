import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Layout from "../components/Layout";
import * as XLSX from "xlsx";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

interface Client {
  _id: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  pensionType?: string;
  pensionAmount?: number;
}

interface Transaction {
  _id: string;
  loanType: "NEW" | "EXTENSION" | "RENEWAL" | "SUKLILOAN";
  dateOfLoan: string;
  startMonth: string;
  endMonth: string;
  loanTerm?: number;
  extensionMonths?: number;
  totalMonths?: number;
  change?: number;
  monthlyAmort?: number;
}

interface EligibleLoanClient {
  client: Client;
  monthlyAmort: number;
  monthsPaid: number;
  totalMonths: number;
  remainingMonths: number;
  canRenew: boolean;
  canExtend: boolean;
  canSukli: boolean;
}

const LOAN_BADGE: Record<string, string> = {
  RENEWAL: "bg-[#ECFDF5] text-[#065F46] border border-[#6EE7B7]",
  EXTENSION: "bg-[#EFF6FF] text-[#1E40AF] border border-[#93C5FD]",
  SUKLILOAN: "bg-[#FDF4FF] text-[#6B21A8] border border-[#D8B4FE]",
};

const STAT_TYPES = ["RENEWAL", "EXTENSION", "SUKLILOAN"] as const;

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "RENEWAL", label: "Renewal" },
  { key: "EXTENSION", label: "Extension" },
  { key: "SUKLILOAN", label: "Sukli Loan" },
] as const;

type LoanFilter = (typeof FILTERS)[number]["key"];

export default function Loan() {
  const [search, setSearch] = useState("");
  const [loanFilter, setLoanFilter] = useState<LoanFilter>("ALL");

  const token = localStorage.getItem("token");

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

  const calculateMonthsPaid = (startDate?: string) => {
    if (!startDate) return 0;

    const start = new Date(startDate);
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

  const getLoanStatus = (transactions: Transaction[]) => {
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(a.dateOfLoan).getTime() - new Date(b.dateOfLoan).getTime(),
    );

    let cycleTotalMonths = 0;
    let cycleStartDate = "";
    let latestChange = 0;

    sorted.forEach((t) => {
      const dateBasedMonths = calculateTotalMonths(t.startMonth, t.endMonth);

      const baseMonths =
        Number(t.loanTerm || 0) ||
        Number(t.totalMonths || 0) ||
        dateBasedMonths;

      const extensionMonths =
        Number(t.extensionMonths || 0) ||
        Number(t.totalMonths || 0) ||
        dateBasedMonths;

      if (t.loanType === "NEW" || t.loanType === "RENEWAL") {
        cycleStartDate = t.startMonth;
        cycleTotalMonths = baseMonths;
      }

      if (t.loanType === "EXTENSION") {
        cycleTotalMonths += extensionMonths;
      }

      latestChange = Number(t.change || 0);
    });

    const monthsPaid = Math.min(
      calculateMonthsPaid(cycleStartDate),
      cycleTotalMonths,
    );

    const remainingMonths = Math.max(0, cycleTotalMonths - monthsPaid);

    return {
      monthsPaid,
      totalMonths: cycleTotalMonths,
      remainingMonths,
      canRenew: cycleTotalMonths > 0 && monthsPaid >= cycleTotalMonths / 2,
      canExtend: cycleTotalMonths > 0 && monthsPaid >= 3 && remainingMonths > 0,
      canSukli: latestChange >= 1000,
    };
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["loan-eligible-clients"],
    queryFn: async () => {
      const clientsRes = await axios.get(`${BACKEND_URL}/api/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const clients = clientsRes.data as Client[];

      const result = await Promise.all(
        clients.map(async (client) => {
          const txRes = await axios.get(
            `${BACKEND_URL}/api/transactions/${client._id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          const transactions = txRes.data as Transaction[];

          const status = getLoanStatus(transactions);

          const latest = [...transactions].sort(
            (a, b) =>
              new Date(b.dateOfLoan).getTime() -
              new Date(a.dateOfLoan).getTime(),
          )[0];

          return {
            client,
            monthlyAmort: Number(latest?.monthlyAmort || 0),
            ...status,
          };
        }),
      );

      return result.filter(
        (item) => item.canRenew || item.canExtend || item.canSukli,
      ) as EligibleLoanClient[];
    },
  });

  const filtered = (data ?? []).filter((item) => {
    const q = search.toLowerCase();
    const c = item.client;

    const matchesSearch =
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.middleName ?? "").toLowerCase().includes(q) ||
      (c.pensionType ?? "").toLowerCase().includes(q);

    const matchesLoanFilter =
      loanFilter === "ALL" ||
      (loanFilter === "RENEWAL" && item.canRenew) ||
      (loanFilter === "EXTENSION" && item.canExtend) ||
      (loanFilter === "SUKLILOAN" && item.canSukli);

    return matchesSearch && matchesLoanFilter;
  });

  const renewalCount = data?.filter((x) => x.canRenew).length ?? 0;
  const extensionCount = data?.filter((x) => x.canExtend).length ?? 0;
  const sukliCount = data?.filter((x) => x.canSukli).length ?? 0;

  const downloadExcel = () => {
    const rows = filtered.map((item) => {
      const c = item.client;

      const availableLoans = [
        item.canRenew ? "Renewal" : null,
        item.canExtend ? "Extension" : null,
        item.canSukli ? "Sukli Loan" : null,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        "Client Name": `${c.lastName}, ${c.firstName} ${c.middleName || ""}`,
        "Pension Type": c.pensionType || "",
        "Monthly Amort": Number(item.monthlyAmort || 0),
        "Months Paid": item.monthsPaid,
        "Total Months": item.totalMonths,
        "Remaining Months": item.remainingMonths,
        "Available Loan": availableLoans,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Loan Availability");

    worksheet["!cols"] = [
      { wch: 32 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 30 },
    ];

    XLSX.writeFile(workbook, "loan-availability.xlsx");
  };

  return (
    <Layout>
      <div
        className="min-h-screen bg-[#F5F6FA] text-[#111827]"
        style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
      >
        <div className="h-1 w-full bg-linear-to-r from-[#F4C430] via-[#e53935] to-[#F4C430]" />

        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e53935] uppercase mb-1">
                Pension Management System
              </p>

              <h1 className="text-2xl font-bold text-[#111827]">
                Loan Availability
              </h1>

              <p className="text-[#9CA3AF] text-xs mt-1">
                {data?.length ?? 0} available client
                {(data?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {STAT_TYPES.map((type) => {
              const count =
                type === "RENEWAL"
                  ? renewalCount
                  : type === "EXTENSION"
                    ? extensionCount
                    : sukliCount;

              const total = data?.length ?? 0;
              const pct = total ? Math.round((count / total) * 100) : 0;

              const accent =
                type === "RENEWAL"
                  ? "#F4C430"
                  : type === "EXTENSION"
                    ? "#e53935"
                    : "#94A3B8";

              return (
                <button
                  key={type}
                  onClick={() => setLoanFilter(type)}
                  className="bg-white border border-[#E5E7EB] rounded-sm px-5 py-4 shadow-sm text-left hover:bg-[#FFFBEB] transition"
                  style={{ borderTop: `3px solid ${accent}` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      {type}
                    </span>

                    <span className="text-2xl font-bold text-[#111827]">
                      {count}
                    </span>
                  </div>

                  <div className="h-1 w-full bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: accent }}
                    />
                  </div>

                  <p className="text-[11px] text-[#9CA3AF] mt-1.5">
                    {pct}% of total
                  </p>
                </button>
              );
            })}
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-sm shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
              <p className="text-sm font-semibold text-[#374151]">
                Available Loan Clients
              </p>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setLoanFilter(f.key)}
                      className={`px-3 py-2 text-[10px] font-bold rounded-sm border transition ${
                        loanFilter === f.key
                          ? "bg-[#111827] text-white border-[#111827]"
                          : "bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#FFFBEB]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={downloadExcel}
                  disabled={filtered.length === 0}
                  className="px-3 py-2 text-[10px] font-bold rounded-sm border bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download Excel
                </button>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm pointer-events-none">
                    ⌕
                  </span>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients..."
                    className="bg-[#F9FAFB] border border-[#E5E7EB] text-[#374151] placeholder-[#9CA3AF] pl-8 pr-4 py-2 text-xs rounded-sm focus:outline-none focus:border-[#F4C430] focus:ring-2 focus:ring-[#F4C43030] transition-all w-56"
                  />
                </div>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-14">
                <div className="w-4 h-4 border-2 border-[#F4C430] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#9CA3AF] text-xs">
                  Loading loan records...
                </span>
              </div>
            )}

            {isError && (
              <div className="m-5 border-l-4 border-[#e53935] bg-[#FEF2F2] px-4 py-3 rounded-sm">
                <p className="text-[#B91C1C] text-xs">
                  ⚠ Failed to load loan records. Please try again.
                </p>
              </div>
            )}

            {!isLoading && !isError && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    {[
                      "Client Name",
                      "Monthly Amort",
                      "Months",
                      "Remaining",
                      "Available Loan",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-bold tracking-widest text-[#6B7280] uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-16 text-center text-[#9CA3AF] text-xs"
                      >
                        {search
                          ? "No clients match your search."
                          : "No clients available for selected filter."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, i) => {
                      const c = item.client;

                      return (
                        <tr
                          key={c._id}
                          className={`border-b border-[#F3F4F6] hover:bg-[#FFFBEB] transition-colors duration-100 ${
                            i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-sm bg-[#111827] flex items-center justify-center text-[10px] font-bold text-[#F4C430] shrink-0">
                                {c.pensionType || "CL"}
                              </div>

                              <div>
                                <p className="font-semibold text-[#111827] leading-tight uppercase">
                                  {c.lastName}, {c.firstName}{" "}
                                  {c.middleName || ""}
                                </p>

                                {c.suffix && (
                                  <p className="text-[11px] text-[#9CA3AF]">
                                    {c.suffix}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-bold text-[#111827]">
                              ₱
                              {Number(item.monthlyAmort || 0).toLocaleString(
                                "en-PH",
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-xs font-bold text-[#374151]">
                            {item.monthsPaid}
                            <span className="text-[#9CA3AF]">
                              {" "}
                              / {item.totalMonths}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-xs font-bold text-[#374151]">
                            {item.remainingMonths}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              {item.canRenew && (
                                <span
                                  className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-sm ${LOAN_BADGE.RENEWAL}`}
                                >
                                  RENEWAL
                                </span>
                              )}

                              {item.canExtend && (
                                <span
                                  className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-sm ${LOAN_BADGE.EXTENSION}`}
                                >
                                  EXTENSION
                                </span>
                              )}

                              {item.canSukli && (
                                <span
                                  className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-sm ${LOAN_BADGE.SUKLILOAN}`}
                                >
                                  SUKLI LOAN
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-[#F3F4F6] flex justify-between items-center bg-[#F9FAFB]">
                <p className="text-[11px] text-[#9CA3AF]">
                  Showing{" "}
                  <span className="font-semibold text-[#374151]">
                    {filtered.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#374151]">
                    {data?.length ?? 0}
                  </span>{" "}
                  records
                </p>

                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F4C430]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e53935]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
