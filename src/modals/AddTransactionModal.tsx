import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const inputBase =
  "w-full border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm rounded-md text-[#111827] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F4C43040] focus:border-[#F4C430] transition";

const readOnlyBase =
  "w-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm rounded-md text-[#111827] focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#374151]">{label}</label>
      {children}
    </div>
  );
}

function SectionDivider({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-xs font-black text-[#F4C430] shadow-sm">
        {step}
      </div>

      <div className="min-w-fit">
        <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>

      <div className="h-0.5 flex-1 rounded-full bg-linear-to-r from-[#F4C430]/70 via-[#E5E7EB] to-transparent" />
    </div>
  );
}

export default function AddTransactionModal({
  open,
  onClose,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
}) {
  const qc = useQueryClient();
  const token = localStorage.getItem("token");

  const [form, setForm] = useState<any>({
    dateOfLoan: "",
    loanType: "",
    dsbNumber: "",
    startMonth: "",
    endMonth: "",
    pension: "",
    monthlyAmort: "",
    totalMonths: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev: any) => {
      const updated = { ...prev, [field]: value };

      const pension = Number(updated.pension);

      if (updated.startMonth && updated.endMonth) {
        const s = new Date(updated.startMonth);
        const e = new Date(updated.endMonth);

        updated.totalMonths =
          (e.getFullYear() - s.getFullYear()) * 12 +
          (e.getMonth() - s.getMonth());
      }

      if (pension && !updated.monthlyAmort) {
        updated.monthlyAmort = Math.floor(pension / 100) * 100;
      }

      return updated;
    });
  };

  const mutation = useMutation({
    mutationFn: () =>
      axios.post(
        `${BACKEND_URL}api/transactions`,
        {
          ...form,
          clientId,
          change: Number(form.pension || 0) - Number(form.monthlyAmort || 0),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", clientId] });
      onClose();
    },
  });

  if (!open) return null;

  const generateAmortOptions = (pension: number) => {
    if (!pension) return [];

    const max = Math.floor(pension / 100) * 100;
    const min = 1000;

    const options: number[] = [];

    for (let i = max; i >= min; i -= 100) {
      options.push(i);
    }

    return options;
  };

  const amortOptions = generateAmortOptions(Number(form.pension));
  const change = Number(form.pension || 0) - Number(form.monthlyAmort || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl"
      >
        <div className="h-1.5 bg-linear-to-r from-[#F4C430] via-[#e53935] to-[#F4C430]" />

        {/* Header */}
        <div className="border-b bg-[#F9FAFB] px-6 py-5">
          <h2 className="text-lg font-black text-[#111827]">
            {form.loanType
              ? `Add ${form.loanType} Transaction`
              : "Add Loan Transaction"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Fill out the transaction details, schedule, and payment information.
          </p>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-7 overflow-y-auto px-6 py-6">
          {/* Section 1 */}
          <section className="space-y-4">
            <SectionDivider
              step="1"
              title="Loan Details"
              description="Basic information about this transaction"
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Transaction Date">
                <input
                  type="date"
                  className={inputBase}
                  value={form.dateOfLoan}
                  onChange={(e) => handleChange("dateOfLoan", e.target.value)}
                />
              </Field>

              <Field label="Loan Type">
                <select
                  className={inputBase}
                  value={form.loanType}
                  onChange={(e) => handleChange("loanType", e.target.value)}
                >
                  <option value="">Select loan type</option>
                  <option value="NEW">New Loan</option>
                  <option value="RENEWAL">Renewal</option>
                  <option value="EXTENSION">Extension</option>
                  <option value="SUKLILOAN">Sukli Loan</option>
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="DSB Number">
                  <input
                    className={inputBase}
                    placeholder="Enter DSB number"
                    value={form.dsbNumber}
                    onChange={(e) => handleChange("dsbNumber", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <SectionDivider
              step="2"
              title="Loan Schedule"
              description="Set the loan coverage and duration"
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Start Month">
                <input
                  type="date"
                  className={inputBase}
                  value={form.startMonth}
                  onChange={(e) => handleChange("startMonth", e.target.value)}
                />
              </Field>

              <Field label="End Month">
                <input
                  type="date"
                  className={inputBase}
                  value={form.endMonth}
                  onChange={(e) => handleChange("endMonth", e.target.value)}
                />
              </Field>

              <Field label="Total Months">
                <input
                  value={form.totalMonths || ""}
                  readOnly
                  className={readOnlyBase}
                  placeholder="Auto-computed"
                />
              </Field>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <SectionDivider
              step="3"
              title="Payment Details"
              description="Pension, amortization, and remaining change"
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Pension Amount">
                <input
                  type="number"
                  className={inputBase}
                  placeholder="₱0.00"
                  value={form.pension}
                  onChange={(e) => handleChange("pension", e.target.value)}
                />
              </Field>

              <Field label="Monthly Amortization">
                <select
                  className={inputBase}
                  value={form.monthlyAmort || ""}
                  onChange={(e) => handleChange("monthlyAmort", e.target.value)}
                >
                  <option value="">Select amort</option>

                  {amortOptions.map((amt) => (
                    <option key={amt} value={amt}>
                      ₱{amt.toLocaleString()}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Change">
                <input
                  value={change || ""}
                  readOnly
                  className={readOnlyBase}
                  placeholder="Auto-computed"
                />
              </Field>
            </div>
          </section>

          {/* Section 4 */}
          <section className="rounded-lg border border-[#F4C43040] bg-[#FFFBEA] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Transaction Summary
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Review the computed values before saving.
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-semibold text-gray-500">
                  Remaining Change
                </p>
                <p className="text-xl font-black text-[#111827]">
                  ₱{change.toLocaleString()}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t bg-[#F9FAFB] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-white"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-[#111827] px-5 py-2 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Saving..." : "Save Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
