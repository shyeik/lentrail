import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import AddClientModal from "../modals/AddClientsModal";
import EditClientModal from "../modals/EditClientModal";
import DeleteConfirmModal from "../modals/DeleteConfirmModal";
import LoanHistoryModal from "../modals/LoanHistoryModal";
import AddTransactionModal from "../modals/AddTransactionModal";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

interface Client {
  _id: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  birthday?: string;
  age?: number;
  loanType?: string;
  pensionType?: string;
  pensionAmount?: number;
}

const LOAN_BADGE: Record<string, string> = {
  RENEWAL: "bg-[#ECFDF5] text-[#065F46] border border-[#6EE7B7]",
  EXTENSION: "bg-[#EFF6FF] text-[#1E40AF] border border-[#93C5FD]",
  SUKLILOAN: "bg-[#FDF4FF] text-[#6B21A8] border border-[#D8B4FE]",
};

const PENSION_TYPES = ["RT", "SD", "ST"] as const;

const PENSION_LABELS: Record<string, string> = {
  RT: "Retirement",
  SD: "Survivor/Death",
  ST: "Disability",
};

const PENSION_COLORS: Record<string, string> = {
  RT: "#F4C430",
  SD: "#e53935",
  ST: "#94A3B8",
};

export default function ClientsPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);

  const token = localStorage.getItem("token");

  const fetchClients = async (): Promise<Client[]> => {
    const res = await axios.get(`${BACKEND_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const formatDate = (date?: string) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatAmount = (amount?: number) => {
    if (amount == null) return "—";
    return `₱${amount.toLocaleString("en-PH")}`;
  };

  const filtered = (data ?? []).filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.pensionType ?? "").toLowerCase().includes(q)
    );
  });

  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      axios.delete(`${BACKEND_URL}/api/clients/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const handleConfirmDelete = () => {
    if (!selectedId) return;

    deleteMutation.mutate(selectedId);
    setDeleteOpen(false);
  };

  return (
    <Layout>
      <div
        className="min-h-screen bg-[#F5F6FA] text-[#111827]"
        style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
      >
        {/* Top accent */}
        <div className="h-1 w-full bg-linear-to-r from-[#F4C430] via-[#e53935] to-[#F4C430]" />

        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e53935] uppercase mb-1">
                Pension Management System
              </p>
              <h1 className="text-2xl font-bold text-[#111827]">
                Client Registry
              </h1>
              {data && (
                <p className="text-[#9CA3AF] text-xs mt-1">
                  {data.length} registered client{data.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white px-5 py-2.5 text-sm font-semibold rounded-sm shadow transition-colors duration-150"
            >
              <span className="text-[#F4C430] text-base leading-none font-black">
                +
              </span>
              Add Client
            </button>
          </div>

          {/* Stat Cards */}
          {data && data.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {PENSION_TYPES.map((type) => {
                const count = data.filter((c) => c.pensionType === type).length;

                const pct = data.length
                  ? Math.round((count / data.length) * 100)
                  : 0;

                const accent = PENSION_COLORS[type];

                return (
                  <div
                    key={type}
                    className="bg-white border border-[#E5E7EB] rounded-sm px-5 py-4 shadow-sm"
                    style={{ borderTop: `3px solid ${accent}` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                        {PENSION_LABELS[type]}
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
                  </div>
                );
              })}
            </div>
          )}
          {/* Table Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-sm shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
              <p className="text-sm font-semibold text-[#374151]">
                All Clients
              </p>
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

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-14">
                <div className="w-4 h-4 border-2 border-[#F4C430] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#9CA3AF] text-xs">
                  Loading records...
                </span>
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="m-5 border-l-4 border-[#e53935] bg-[#FEF2F2] px-4 py-3 rounded-sm">
                <p className="text-[#B91C1C] text-xs">
                  ⚠ Failed to load client records. Please try again.
                </p>
              </div>
            )}

            {/* Table */}
            {data && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    {[
                      "Client Name",
                      "Birthday",
                      "Age",
                      "Loan Type",
                      "Amount",
                      "Actions",
                      "Transactions",
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
                        colSpan={6}
                        className="py-16 text-center text-[#9CA3AF] text-xs"
                      >
                        {search
                          ? "No clients match your search."
                          : "No clients registered yet."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c, i) => (
                      <tr
                        key={c._id}
                        className={`border-b border-[#F3F4F6] hover:bg-[#FFFBEB] transition-colors duration-100 ${
                          i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                        }`}
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-sm bg-[#111827] flex items-center justify-center text-[10px] font-bold text-[#F4C430] shrink-0">
                              {c.pensionType}
                            </div>
                            <div>
                              <p className="font-semibold text-[#111827] leading-tight">
                                {c.lastName}, {c.firstName} {c.middleName || ""}
                              </p>
                              {c.suffix && (
                                <p className="text-[11px] text-[#9CA3AF]">
                                  {c.suffix}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Birthday */}
                        <td className="px-4 py-3 text-xs text-[#6B7280]">
                          {formatDate(c.birthday)}
                        </td>

                        {/* Age */}
                        <td className="px-4 py-3 text-xs font-medium text-[#374151]">
                          {c.age ?? "—"}
                        </td>

                        {/* Loan Type */}
                        <td className="px-4 py-3">
                          {c.loanType ? (
                            <span
                              className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-sm ${LOAN_BADGE[c.loanType] ?? "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"}`}
                            >
                              {c.loanType}
                            </span>
                          ) : (
                            <span className="text-[#D1D5DB] text-xs">—</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3">
                          <span
                            className={`font-bold ${c.pensionAmount ? "text-[#111827]" : "text-[#D1D5DB]"}`}
                          >
                            {formatAmount(c.pensionAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedClient(c);
                              setEditOpen(true);
                            }}
                            className="text-xs px-2 py-1 bg-yellow-400 rounded"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => {
                              setSelectedId(c._id);
                              setDeleteOpen(true);
                            }}
                            className="text-xs px-2 py-1 bg-red-500 text-white rounded"
                          >
                            Delete
                          </button>
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setSelectedClient(c);
                              setHistoryOpen(true);
                            }}
                            className="text-red-500 text-xs font-semibold hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* Table Footer */}
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
      <EditClientModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={selectedClient}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      <LoanHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        client={selectedClient}
        onAdd={() => setTransactionOpen(true)}
      />

      <AddTransactionModal
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        clientId={selectedClient?._id || ""}
      />

      <AddClientModal open={open} onClose={() => setOpen(false)} />
    </Layout>
  );
}
