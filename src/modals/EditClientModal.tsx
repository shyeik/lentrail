import { useEffect, useState } from "react";
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

const inputBase =
  "w-full bg-white border border-[#E5E7EB] text-[#111827] rounded-sm px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#F4C430] focus:ring-2 focus:ring-[#F4C43025]";

const labelBase =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280] mb-1.5";

export default function EditClientModal({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client: any;
}) {
  const qc = useQueryClient();
  const token = localStorage.getItem("token");

  const [form, setForm] = useState<ClientForm>({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    birthday: "",
    age: undefined,
    loanType: "",
    pensionType: "",
    pensionAmount: undefined,
  });

  const [error, setError] = useState("");

  // ✅ PREFILL FORM
  useEffect(() => {
    if (client) {
      setForm({
        ...client,
        birthday: client.birthday ? client.birthday.split("T")[0] : "",
      });
    }
  }, [client]);

  const set =
    (field: keyof ClientForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;

      setForm((prev) => ({
        ...prev,
        [field]:
          field === "age" || field === "pensionAmount"
            ? value === ""
              ? undefined
              : Number(value)
            : value,
      }));
    };

  const mutation = useMutation({
    mutationFn: async () =>
      axios.put(`${BACKEND_URL}api/clients/${client._id}`, form, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      onClose();
    },
    onError: () => {
      setError("Failed to update client");
    },
  });

  if (!open || !client) return null;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)" }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-sm shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-7 py-5 border-b bg-[#F9FAFB] flex justify-between">
          <div>
            <p className="text-[10px] text-[#e53935] uppercase">
              Client Registry
            </p>
            <h2 className="text-lg font-bold">Edit Client</h2>
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
        <div className="px-7 py-6 space-y-6">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Personal */}
          <SectionDivider step="1" title="Personal Information" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelBase}>First Name</label>
              <input
                className={inputBase}
                value={form.firstName}
                onChange={set("firstName")}
              />
            </div>

            <div>
              <label className={labelBase}>Last Name</label>
              <input
                className={inputBase}
                value={form.lastName}
                onChange={set("lastName")}
              />
            </div>

            <div>
              <label className={labelBase}>Middle Name</label>
              <input
                className={inputBase}
                value={form.middleName || ""}
                onChange={set("middleName")}
              />
            </div>

            <div>
              <label className={labelBase}>Suffix</label>
              <input
                className={inputBase}
                value={form.suffix || ""}
                onChange={set("suffix")}
              />
            </div>
          </div>

          {/* Date */}
          <SectionDivider step="2" title="Date & Age" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelBase}>Birthday</label>
              <input
                type="date"
                className={inputBase}
                value={form.birthday || ""}
                onChange={set("birthday")}
              />
            </div>

            <div>
              <label className={labelBase}>Age</label>
              <input
                type="number"
                className={inputBase}
                value={form.age ?? ""}
                onChange={set("age")}
              />
            </div>
          </div>

          {/* Loan */}
          <SectionDivider step="3" title="Pension Information" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelBase}>Pension Type</label>
              <select
                className={inputBase}
                value={form.pensionType || ""}
                onChange={set("pensionType")}
              >
                <option value="">Select</option>
                <option value="RT">Retirement</option>
                <option value="SD">Survivor</option>
                <option value="ST">Disability</option>
              </select>
            </div>

            <div>
              <label className={labelBase}>Loan Type</label>
              <select
                className={inputBase}
                value={form.loanType || ""}
                onChange={set("loanType")}
              >
                <option value="">Select</option>
                <option value="RENEWAL">Renewal</option>
                <option value="EXTENSION">Extension</option>
                <option value="SUKLILOAN">Sukli</option>
              </select>
            </div>

            <div>
              <label className={labelBase}>Amount</label>
              <input
                type="number"
                className={inputBase}
                value={form.pensionAmount ?? ""}
                onChange={set("pensionAmount")}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 flex justify-between gap-2  bg-[#F9FAFB]">
          <button
            onClick={onClose}
            className="bg-[#E5E7EB] text-[#6B7280] hover:text-[#111827] px-4 py-2 rounded"
          >
            Cancel
          </button>
          <button className="bg-[#111827] text-white px-4 py-2 rounded">
            {mutation.isPending ? "Updating..." : "Update"}
          </button>
        </div>
      </form>
    </div>
  );
}
