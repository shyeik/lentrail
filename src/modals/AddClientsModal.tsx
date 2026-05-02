import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

interface ClientForm {
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

const EMPTY_FORM: ClientForm = {
  lastName: "",
  firstName: "",
  middleName: "",
  suffix: "",
  birthday: "",
  age: undefined,
  loanType: "",
  pensionType: "",
  pensionAmount: undefined,
};

const inputBase =
  "w-full bg-white border border-[#E5E7EB] text-[#111827] placeholder-[#9CA3AF] rounded-sm px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#F4C430] focus:ring-2 focus:ring-[#F4C43025] transition-all duration-150";

const labelBase =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280] mb-1.5";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelBase}>{label}</label>
      {children}
    </div>
  );
}

function SectionDivider({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-5 h-5 rounded-sm bg-[#111827] text-[#F4C430] text-[9px] font-black flex items-center justify-center shrink-0">
        {step}
      </span>
      <span className="text-xs font-semibold text-[#374151] uppercase tracking-wide">
        {title}
      </span>
      <div className="flex-1 h-px bg-[#E5E7EB]" />
    </div>
  );
}

const calculateAge = (birthday: string) => {
  if (!birthday) return undefined;

  const birthDate = new Date(birthday);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

export default function AddClientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const mutation = useMutation({
    mutationFn: async (payload: ClientForm) => {
      return axios.post(`${BACKEND_URL}api/clients`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setForm(EMPTY_FORM);
      setError("");
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || "Failed to create client");
    },
  });

  const set =
    (field: keyof ClientForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;

      setForm((prev) => {
        const updated = {
          ...prev,
          [field]:
            field === "age" || field === "pensionAmount"
              ? value === ""
                ? undefined
                : Number(value)
              : value,
        };

        // ✅ AUTO AGE
        if (field === "birthday") {
          updated.age = calculateAge(value);
        }

        return updated;
      });
    };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName || !form.lastName) {
      setError("First name and last name are required.");
      return;
    }

    if (!form.birthday || form.age === undefined) {
      setError("Birthday is required to calculate age.");
      return;
    }

    if (form.age > 85) {
      setError("Client is not eligible. Maximum allowed age is 85 years old.");
      return;
    }

    setError("");
    mutation.mutate(form);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)" }}
    >
      <form
        onSubmit={submit}
        className="relative w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-sm shadow-xl overflow-hidden"
      >
        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to- from-[#F4C430] via-[#e53935] to-[#F4C430]" />

        {/* Header */}
        <div className="px-7 py-5 flex items-start justify-between border-b border-[#F3F4F6] bg-[#F9FAFB]">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#e53935] uppercase mb-0.5">
              Client Registry
            </p>
            <h2 className="text-lg font-bold text-[#111827]">
              New Client Entry
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-1 w-7 h-7 flex items-center justify-center border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#111827] hover:border-[#9CA3AF] transition-all duration-150 text-xs rounded-sm bg-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6 bg-white">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 border-l-4 border-[#e53935] bg-[#FEF2F2] px-4 py-3 rounded-sm">
              <span className="text-[#e53935] text-xs">⚠</span>
              <p className="text-[#B91C1C] text-xs">{error}</p>
            </div>
          )}

          {/* 01 Personal */}
          <div>
            <SectionDivider step="1" title="Personal Information" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name">
                <input
                  className={inputBase}
                  placeholder="e.g. Juan"
                  value={form.firstName}
                  onChange={set("firstName")}
                />
              </Field>
              <Field label="Last Name">
                <input
                  className={inputBase}
                  placeholder="e.g. Dela Cruz"
                  value={form.lastName}
                  onChange={set("lastName")}
                />
              </Field>
              <Field label="Middle Name">
                <input
                  className={inputBase}
                  placeholder="Optional"
                  value={form.middleName || ""}
                  onChange={set("middleName")}
                />
              </Field>
              <Field label="Suffix">
                <select
                  className={inputBase}
                  value={form.suffix || ""}
                  onChange={set("suffix")}
                >
                  <option value="">Select Suffix</option>
                  <option value="JR">Jr.</option>
                  <option value="SR">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                </select>
              </Field>
            </div>
          </div>

          {/* 02 Date & Age */}
          <div>
            <SectionDivider step="2" title="Date & Age" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Birth">
                <input
                  type="date"
                  className={inputBase}
                  value={form.birthday || ""}
                  onChange={set("birthday")}
                />
              </Field>
              <Field label="Age">
                <input
                  type="number"
                  className={`${inputBase} bg-gray-100 cursor-not-allowed`}
                  value={form.age ?? ""}
                  readOnly
                />
                {form.age !== undefined && form.age > 85 && (
                  <p className="text-[11px] text-[#B91C1C] mt-1">
                    Maximum allowed age is 85 years old.
                  </p>
                )}
              </Field>
            </div>
          </div>

          {/* 03 Pension */}
          <div>
            <SectionDivider step="3" title="Pension Information" />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Pension Type">
                <select
                  className={inputBase}
                  value={form.pensionType || ""}
                  onChange={set("pensionType")}
                >
                  <option value="">Select Type</option>
                  <option value="RT">Retirement</option>
                  <option value="SD">Survivor/Death</option>
                  <option value="ST">Disability</option>
                </select>
              </Field>

              <Field label="Loan Type">
                <select
                  className={inputBase}
                  value={form.loanType || ""}
                  onChange={set("loanType")}
                >
                  <option value="">Select Type</option>
                  <option value="RENEW">Renewal</option>
                  <option value="EXT">Extension</option>
                  <option value="SUKLI">Sukli Loan</option>
                </select>
              </Field>

              <Field label="Monthly Amount (₱)">
                <input
                  type="number"
                  className={inputBase}
                  placeholder="e.g. 5,000"
                  value={form.pensionAmount ?? ""}
                  onChange={set("pensionAmount")}
                  min={0}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 flex justify-between items-center border-t border-[#F3F4F6] bg-[#F9FAFB]">
          <button
            onClick={onClose}
            className="bg-[#E5E7EB] text-[#6B7280] hover:text-[#111827] px-4 py-2 rounded"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white px-6 py-2.5 text-sm font-semibold rounded-sm shadow transition-colors duration-150"
          >
            {mutation.isPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <span className="text-[#F4C430]">✓</span>
                Save Client
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
