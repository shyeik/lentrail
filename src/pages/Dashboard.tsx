import Layout from "../components/Layout";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  computeLoanProfit,
  buildComputationInput,
  computeBatch,
  type LoanType,
  type LoanComputationResult,
  type BatchResult,
} from "./computation/LoanComputation";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  loanType: LoanType;
  dateOfLoan: string;
  startMonth: string;
  endMonth: string;
  loanAmount?: number;
  loanTerm?: number;
  extensionMonths?: number;
  totalMonths?: number;
  change?: number;
  monthlyAmort?: number;
  // Renewal context (may be derived or stored)
  remainingMonthsNotPaid?: number;
  oldMonthlyAmort?: number;
}

interface ClientWithTransactions {
  client: Client;
  transactions: Transaction[];
  latestTx?: Transaction;
  computation?: LoanComputationResult;
  // Eligibility
  monthsPaid: number;
  totalMonths: number;
  remainingMonths: number;
  monthlyAmort: number;
  canRenew: boolean;
  canExtend: boolean;
  canSukli: boolean;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: "#0A0C10",
  surface: "#0D1117",
  surfaceHigh: "#161B22",
  surfaceMid: "#21262D",
  border: "#30363D",
  borderSub: "#21262D",
  text: "#E6EDF3",
  muted: "#7D8590",
  subtle: "#484F58",
  gold: "#D4A017",
  goldBright: "#F0C040",
  goldDim: "#7A5C0A",
  red: "#DA3633",
  redDim: "#6E1A18",
  green: "#2EA043",
  greenDim: "#1A3D22",
  blue: "#388BFD",
  blueDim: "#1B3A6E",
  purple: "#8957E5",
  purpleDim: "#3B2A6E",
};

const LOAN_COLOR: Record<LoanType, string> = {
  NEW: C.green,
  RENEWAL: C.gold,
  EXTENSION: C.red,
  SUKLILOAN: C.blue,
};

const LOAN_DIM: Record<LoanType, string> = {
  NEW: C.greenDim,
  RENEWAL: C.goldDim,
  EXTENSION: C.redDim,
  SUKLILOAN: C.blueDim,
};

// ── Utilities ─────────────────────────────────────────────────────────────────

const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
const pesoK = (n: number) => {
  const v = Math.round(n);
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}K`;
  return peso(v);
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function last6Months() {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}
function shortMon(k: string) {
  const [y, m] = k.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-PH", {
    month: "short",
  });
}
function growthRate(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

// ── Loan status ───────────────────────────────────────────────────────────────

function calcTotalMonths(s?: string, e?: string) {
  if (!s || !e) return 0;
  const start = new Date(s),
    end = new Date(e);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  let m =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (end.getDate() >= start.getDate()) m += 1;
  return Math.max(0, m);
}
function calcMonthsPaid(startDate?: string) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const today = new Date();
  if (isNaN(start.getTime())) return 0;
  let m =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());
  if (today.getDate() >= start.getDate()) m += 1;
  return Math.max(0, m);
}
function getLoanCycleStatus(transactions: Transaction[]) {
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.dateOfLoan).getTime() - new Date(b.dateOfLoan).getTime(),
  );
  let cycleTotalMonths = 0,
    cycleStartDate = "",
    latestChange = 0;
  sorted.forEach((t) => {
    const db = calcTotalMonths(t.startMonth, t.endMonth);
    const base = Number(t.loanTerm || 0) || Number(t.totalMonths || 0) || db;
    const ext =
      Number(t.extensionMonths || 0) || Number(t.totalMonths || 0) || db;
    if (t.loanType === "NEW" || t.loanType === "RENEWAL") {
      cycleStartDate = t.startMonth;
      cycleTotalMonths = base;
    }
    if (t.loanType === "EXTENSION") cycleTotalMonths += ext;
    latestChange = Number(t.change || 0);
  });
  const monthsPaid = Math.min(calcMonthsPaid(cycleStartDate), cycleTotalMonths);
  const remainingMonths = Math.max(0, cycleTotalMonths - monthsPaid);
  return {
    monthsPaid,
    totalMonths: cycleTotalMonths,
    remainingMonths,
    canRenew: cycleTotalMonths > 0 && monthsPaid >= cycleTotalMonths / 2,
    canExtend: cycleTotalMonths > 0 && monthsPaid >= 3 && remainingMonths > 0,
    canSukli: latestChange >= 1000,
  };
}

// ── SVG Charts ────────────────────────────────────────────────────────────────

function MiniSpark({
  vals,
  color,
  w = 100,
  h = 32,
}: {
  vals: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 1),
    min = Math.min(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  });
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1].split(",")[0]}
        cy={pts[pts.length - 1].split(",")[1]}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

function RevenueTrendChart({
  months,
  revenueByMonth,
  netReleaseByMonth,
}: {
  months: string[];
  revenueByMonth: Record<string, number>;
  netReleaseByMonth: Record<string, number>;
}) {
  const W = 540,
    H = 180,
    PL = 10,
    PR = 10,
    PT = 20,
    PB = 36;
  const cW = W - PL - PR,
    cH = H - PT - PB;
  const revVals = months.map((m) => revenueByMonth[m] ?? 0);
  const releaseVals = months.map((m) => netReleaseByMonth[m] ?? 0);
  const maxVal = Math.max(...revVals, ...releaseVals, 1);
  const bW = (cW / months.length) * 0.38;
  const step = cW / months.length;

  const linePts = releaseVals.map((v, i) => {
    const x = PL + i * step + step / 2;
    const y = PT + cH - (v / maxVal) * cH;
    return `${x},${y}`;
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={PL}
          x2={W - PR}
          y1={PT + cH * (1 - f)}
          y2={PT + cH * (1 - f)}
          stroke={C.border}
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}

      {/* Revenue bars */}
      {revVals.map((v, i) => {
        const bh = (v / maxVal) * cH;
        const x = PL + i * step + (step - bW) / 2;
        const y = PT + cH - bh;
        const isLast = i === revVals.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={bW}
            height={bh}
            rx="3"
            fill={isLast ? C.gold : C.surfaceMid}
            opacity={isLast ? 1 : 0.8}
          />
        );
      })}

      {/* Net release line */}
      {releaseVals.length > 1 && (
        <>
          <polyline
            points={linePts.join(" ")}
            fill="none"
            stroke={C.green}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {releaseVals.map((_, i) => {
            const [x, y] = linePts[i].split(",");
            return <circle key={i} cx={x} cy={y} r="3" fill={C.green} />;
          })}
        </>
      )}

      {/* X labels */}
      {months.map((k, i) => (
        <text
          key={k}
          x={PL + i * step + step / 2}
          y={H - 10}
          textAnchor="middle"
          fontSize="10"
          fill={C.muted}
        >
          {shortMon(k)}
        </text>
      ))}

      {/* Legend */}
      <rect x={PL} y={3} width={10} height={6} rx="1" fill={C.surfaceMid} />
      <text x={PL + 13} y={10} fontSize="9" fill={C.muted}>
        Revenue (₱)
      </text>
      <circle cx={PL + 100} cy={6} r="3" fill={C.green} />
      <text x={PL + 106} y={10} fontSize="9" fill={C.muted}>
        Net Release (₱)
      </text>
    </svg>
  );
}

function LoanTypeBreakdown({ batch }: { batch: BatchResult }) {
  const types: LoanType[] = ["NEW", "RENEWAL", "EXTENSION", "SUKLILOAN"];
  const maxRev = Math.max(
    ...types.map((t) => batch.byType[t]?.revenue ?? 0),
    1,
  );
  return (
    <div className="flex flex-col gap-3.5">
      {types.map((type) => {
        const d = batch.byType[type];
        if (!d)
          return (
            <div key={type} className="flex items-center gap-3">
              <span
                className="text-[10px] font-black uppercase tracking-widest w-20 shrink-0"
                style={{ color: C.subtle }}
              >
                {type === "SUKLILOAN" ? "SUKLI" : type}
              </span>
              <div
                className="flex-1 h-1.5 rounded-full"
                style={{ background: C.surfaceMid }}
              />
              <span
                className="text-[10px] w-16 text-right shrink-0"
                style={{ color: C.subtle }}
              >
                —
              </span>
            </div>
          );
        const pct = Math.round((d.revenue / maxRev) * 100);
        const col = LOAN_COLOR[type];
        return (
          <div key={type} className="flex items-center gap-3">
            <span
              className="text-[10px] font-black uppercase tracking-widest w-20 shrink-0"
              style={{ color: col }}
            >
              {type === "SUKLILOAN" ? "SUKLI" : type}
            </span>
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: C.surfaceMid }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: col }}
              />
            </div>
            <span
              className="text-[10px] font-bold w-16 text-right shrink-0"
              style={{ color: C.text }}
            >
              {pesoK(d.revenue)}
            </span>
            <span
              className="text-[10px] w-8 text-right shrink-0"
              style={{ color: C.muted }}
            >
              {d.count}×
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  trend,
  spark,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  spark?: number[];
  accent: string;
  icon: string;
}) {
  const up = (trend ?? 0) >= 0;
  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col gap-2.5 relative overflow-hidden"
      style={{
        background: C.surfaceHigh,
        border: `1px solid ${C.border}`,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-[9px] font-black uppercase tracking-[0.18em] mb-1"
            style={{ color: C.muted }}
          >
            {label}
          </p>
          <p
            className="text-xl font-black leading-none"
            style={{ color: C.text }}
          >
            {value}
          </p>
          {sub && (
            <p className="text-[10px] mt-1" style={{ color: C.muted }}>
              {sub}
            </p>
          )}
        </div>
        <span className="text-xl opacity-20 shrink-0 select-none">{icon}</span>
      </div>
      <div className="flex items-end justify-between mt-auto pt-1">
        {trend !== undefined ? (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: up ? C.greenDim : C.redDim,
              color: up ? "#4ade80" : "#f87171",
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(trend)}% MoM
          </span>
        ) : (
          <span />
        )}
        {spark && spark.length > 1 && <MiniSpark vals={spark} color={accent} />}
      </div>
    </div>
  );
}

// ── Profit Breakdown Row ──────────────────────────────────────────────────────

function ProfitRow({ item }: { item: ClientWithTransactions }) {
  const c = item.client;
  const comp = item.computation;
  const tags: { label: string; color: string }[] = [];
  if (item.canRenew) tags.push({ label: "RENEW", color: C.gold });
  if (item.canExtend) tags.push({ label: "EXTEND", color: C.red });
  if (item.canSukli) tags.push({ label: "SUKLI", color: C.blue });

  const loanColor = item.latestTx
    ? LOAN_COLOR[item.latestTx.loanType]
    : C.muted;

  return (
    <tr
      className="border-b transition-colors group"
      style={{ borderColor: C.borderSub }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.surfaceMid)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Client */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0"
            style={{
              background: C.surfaceMid,
              color: C.gold,
              border: `1px solid ${C.border}`,
            }}
          >
            {c.pensionType?.slice(0, 3).toUpperCase() ?? "CLT"}
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase leading-tight"
              style={{ color: C.text }}
            >
              {c.lastName}, {c.firstName} {c.middleName ?? ""}
            </p>
            <p className="text-[10px]" style={{ color: C.muted }}>
              {c.pensionType ?? "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Loan Type */}
      <td className="px-4 py-3">
        {item.latestTx && (
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-md"
            style={{
              background: LOAN_DIM[item.latestTx.loanType],
              color: loanColor,
              border: `1px solid ${loanColor}44`,
            }}
          >
            {item.latestTx.loanType}
          </span>
        )}
      </td>

      {/* Principal */}
      <td className="px-4 py-3">
        <span className="text-xs font-bold" style={{ color: C.text }}>
          {comp ? pesoK(comp.principalLoan) : "—"}
        </span>
      </td>

      {/* Net Release */}
      <td className="px-4 py-3">
        <span className="text-xs font-bold" style={{ color: C.green }}>
          {comp ? peso(comp.netRelease) : "—"}
        </span>
      </td>

      {/* Revenue (company earnings) */}
      <td className="px-4 py-3">
        <span className="text-xs font-black" style={{ color: C.gold }}>
          {comp ? peso(comp.revenue) : "—"}
        </span>
        {comp && (
          <div className="text-[9px] mt-0.5" style={{ color: C.muted }}>
            I:{peso(comp.interest)} · S:{peso(comp.serviceFee)} · D:
            {peso(comp.docStamp)}
          </div>
        )}
      </td>

      {/* Remaining */}
      <td className="px-4 py-3">
        <span className="text-xs font-bold" style={{ color: C.text }}>
          {item.remainingMonths}
          <span style={{ color: C.muted, fontWeight: 400 }}> mos</span>
        </span>
      </td>

      {/* Eligibility */}
      <td className="px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {tags.map((t) => (
            <span
              key={t.label}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: t.color + "22",
                color: t.color,
                border: `1px solid ${t.color}44`,
              }}
            >
              {t.label}
            </span>
          ))}
          {tags.length === 0 && (
            <span style={{ color: C.subtle }} className="text-[10px]">
              —
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

type TabKey = "overview" | "profit" | "opportunities";
type LoanFilter = "ALL" | LoanType;

const FILTERS: { key: LoanFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "RENEWAL", label: "Renewal" },
  { key: "EXTENSION", label: "Extension" },
  { key: "SUKLILOAN", label: "Sukli" },
];

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [loanFilter, setLoanFilter] = useState<LoanFilter>("ALL");
  const [tab, setTab] = useState<TabKey>("overview");
  const token = localStorage.getItem("token");

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const {
    data: allClients,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["dashboard-v3"],
    queryFn: async () => {
      const clientsRes = await axios.get(`${BACKEND_URL}api/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const clients = clientsRes.data as Client[];

      return Promise.all(
        clients.map(async (client) => {
          const txRes = await axios.get(
            `${BACKEND_URL}api/transactions/${client._id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const transactions = txRes.data as Transaction[];
          const cycleStatus = getLoanCycleStatus(transactions);

          const sorted = [...transactions].sort(
            (a, b) =>
              new Date(b.dateOfLoan).getTime() -
              new Date(a.dateOfLoan).getTime(),
          );
          const latestTx = sorted[0];

          // Build computation input for the latest transaction
          let computation: LoanComputationResult | undefined;
          if (latestTx) {
            // For RENEWAL, derive remaining months not paid from previous cycle
            const txWithCtx: Transaction = { ...latestTx };
            if (latestTx.loanType === "RENEWAL") {
              txWithCtx.remainingMonthsNotPaid = cycleStatus.remainingMonths;
              // oldMonthlyAmort: use the transaction before the latest renewal
              const prevTx = sorted[1];
              txWithCtx.oldMonthlyAmort = Number(prevTx?.monthlyAmort || 0);
            }
            const input = buildComputationInput(txWithCtx);
            if (input) computation = computeLoanProfit(input);
          }

          return {
            client,
            transactions,
            latestTx,
            computation,
            monthlyAmort: Number(latestTx?.monthlyAmort || 0),
            ...cycleStatus,
          } as ClientWithTransactions;
        }),
      );
    },
  });

  // ── Analytics ──────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (!allClients) return null;

    const months = last6Months();

    // Per-month revenue & net release using computation engine
    const revenueByMonth: Record<string, number> = {};
    const netReleaseByMonth: Record<string, number> = {};
    const countByMonth: Record<string, number> = {};
    months.forEach((m) => {
      revenueByMonth[m] = 0;
      netReleaseByMonth[m] = 0;
      countByMonth[m] = 0;
    });

    const computationInputs = allClients
      .map((c) => {
        if (!c.latestTx) return null;
        const txWithCtx: Transaction = { ...c.latestTx };
        if (c.latestTx.loanType === "RENEWAL") {
          txWithCtx.remainingMonthsNotPaid = c.remainingMonths;
          const sorted = [...c.transactions].sort(
            (a, b) =>
              new Date(b.dateOfLoan).getTime() -
              new Date(a.dateOfLoan).getTime(),
          );
          txWithCtx.oldMonthlyAmort = Number(sorted[1]?.monthlyAmort || 0);
        }
        return buildComputationInput(txWithCtx);
      })
      .filter(Boolean) as Parameters<typeof computeLoanProfit>[0][];

    const batch = computeBatch(computationInputs);

    // Monthly breakdown (based on dateOfLoan of latest tx per client)
    allClients.forEach((c) => {
      if (!c.latestTx || !c.computation) return;
      const k = monthKey(new Date(c.latestTx.dateOfLoan));
      if (!months.includes(k)) return;
      revenueByMonth[k] = (revenueByMonth[k] ?? 0) + c.computation.revenue;
      netReleaseByMonth[k] =
        (netReleaseByMonth[k] ?? 0) + c.computation.netRelease;
      countByMonth[k] = (countByMonth[k] ?? 0) + 1;
    });

    const revVals = months.map((m) => revenueByMonth[m]);
    const curRev = revVals[revVals.length - 1];
    const prevRev = revVals[revVals.length - 2] ?? 0;
    const moGrowth = growthRate(curRev, prevRev);

    const eligible = allClients.filter(
      (c) => c.canRenew || c.canExtend || c.canSukli,
    );
    const renewalEligible = allClients.filter((c) => c.canRenew);
    const extensionEligible = allClients.filter((c) => c.canExtend);
    const sukliEligible = allClients.filter((c) => c.canSukli);

    // Pipeline: estimate revenue from eligible clients (using avg revenue of their latest tx)
    const avgRevenue =
      batch.totalRevenue /
      (allClients.filter((c) => c.computation).length || 1);
    const pipelineRevenue = eligible.length * avgRevenue;

    return {
      batch,
      months,
      revenueByMonth,
      netReleaseByMonth,
      countByMonth,
      revVals,
      moGrowth,
      eligible,
      renewalEligible,
      extensionEligible,
      sukliEligible,
      pipelineRevenue,
      totalClients: allClients.length,
      avgRevenue,
    };
  }, [allClients]);

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!allClients) return [];
    const q = search.toLowerCase();
    return allClients.filter((item) => {
      const c = item.client;
      const matchesSearch =
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.middleName ?? "").toLowerCase().includes(q) ||
        (c.pensionType ?? "").toLowerCase().includes(q);
      const matchesFilter =
        loanFilter === "ALL" || item.latestTx?.loanType === loanFilter;
      return matchesSearch && matchesFilter;
    });
  }, [allClients, search, loanFilter]);

  const eligibleFiltered = useMemo(() => {
    if (!analytics) return [];
    const q = search.toLowerCase();
    return analytics.eligible.filter((item) => {
      const c = item.client;
      return (
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.pensionType ?? "").toLowerCase().includes(q)
      );
    });
  }, [analytics, search]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabDefs: { key: TabKey; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "▦" },
    { key: "profit", label: "Profit Detail", icon: "₱" },
    { key: "opportunities", label: "Opportunities", icon: "◎" },
  ];

  return (
    <Layout>
      <div
        className="min-h-screen"
        style={{
          background: C.bg,
          color: C.text,
          fontFamily:
            "'Geist Mono', 'IBM Plex Mono', 'Cascadia Code', monospace",
        }}
      >
        {/* Accent bar */}
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${C.gold}, ${C.red}, ${C.gold}, transparent)`,
          }}
        />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <p
                className="text-[10px] font-black tracking-[0.25em] uppercase mb-1.5"
                style={{ color: C.gold }}
              >
                ◆ Pension Loan System
              </p>
              <h1
                className="text-3xl font-black tracking-tight leading-none"
                style={{ color: C.text }}
              >
                Sales &amp; Profit Dashboard
              </h1>
              <p className="text-xs mt-2" style={{ color: C.muted }}>
                Revenue · Net Release · Profit Breakdown · Pipeline Intelligence
              </p>
            </div>
            <div
              className="text-right px-4 py-3 rounded-xl"
              style={{
                background: C.surfaceHigh,
                border: `1px solid ${C.border}`,
              }}
            >
              <p
                className="text-[9px] uppercase tracking-widest"
                style={{ color: C.muted }}
              >
                Updated
              </p>
              <p
                className="text-sm font-black mt-0.5"
                style={{ color: C.text }}
              >
                {new Date().toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Tab nav */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-8 w-fit"
            style={{
              background: C.surfaceHigh,
              border: `1px solid ${C.border}`,
            }}
          >
            {tabDefs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200"
                style={
                  tab === t.key
                    ? { background: C.gold, color: C.bg }
                    : { color: C.muted }
                }
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center gap-3 py-32">
              <div
                className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{
                  borderColor: `${C.gold} transparent ${C.gold} ${C.gold}`,
                }}
              />
              <span className="text-xs" style={{ color: C.muted }}>
                Computing profit data...
              </span>
            </div>
          )}

          {isError && (
            <div
              className="px-4 py-3 rounded-xl mb-6"
              style={{
                background: C.redDim,
                border: `1px solid ${C.red}`,
                color: "#f87171",
              }}
            >
              ⚠ Failed to load data. Please refresh.
            </div>
          )}

          {!isLoading && !isError && analytics && (
            <>
              {/* ── OVERVIEW TAB ───────────────────────────────────────── */}
              {tab === "overview" && (
                <>
                  {/* KPI Row */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <KpiCard
                      label="Total Revenue"
                      value={pesoK(analytics.batch.totalRevenue)}
                      sub={`${analytics.totalClients} clients`}
                      trend={analytics.moGrowth}
                      spark={analytics.revVals}
                      accent={C.gold}
                      icon="₱"
                    />
                    <KpiCard
                      label="Total Net Release"
                      value={pesoK(analytics.batch.totalNetRelease)}
                      sub="cash to clients"
                      accent={C.green}
                      icon="→"
                    />
                    <KpiCard
                      label="Avg Revenue / Loan"
                      value={pesoK(analytics.avgRevenue)}
                      sub="per transaction"
                      accent={C.blue}
                      icon="≈"
                    />
                    <KpiCard
                      label="Pipeline Revenue"
                      value={pesoK(analytics.pipelineRevenue)}
                      sub={`${analytics.eligible.length} eligible clients`}
                      accent={C.purple}
                      icon="◎"
                    />
                  </div>

                  {/* Revenue breakdown row */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      {
                        label: "Total Interest",
                        value: analytics.batch.totalInterest,
                        color: C.gold,
                        icon: "%",
                      },
                      {
                        label: "Total Service Fee",
                        value: analytics.batch.totalServiceFee,
                        color: C.red,
                        icon: "S",
                      },
                      {
                        label: "Total Doc Stamp",
                        value: analytics.batch.totalDocStamp,
                        color: C.blue,
                        icon: "D",
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="rounded-xl px-5 py-3.5"
                        style={{
                          background: C.surfaceHigh,
                          border: `1px solid ${C.border}`,
                          borderLeft: `3px solid ${m.color}`,
                        }}
                      >
                        <p
                          className="text-[9px] font-black uppercase tracking-widest mb-1"
                          style={{ color: C.muted }}
                        >
                          {m.icon} {m.label}
                        </p>
                        <p
                          className="text-xl font-black"
                          style={{ color: m.color }}
                        >
                          {pesoK(m.value)}
                        </p>
                        <p
                          className="text-[9px] mt-1"
                          style={{ color: C.muted }}
                        >
                          {analytics.batch.totalRevenue > 0
                            ? Math.round(
                                (m.value / analytics.batch.totalRevenue) * 100,
                              )
                            : 0}
                          % of total revenue
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Charts row */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div
                      className="col-span-2 rounded-xl p-5"
                      style={{
                        background: C.surfaceHigh,
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p
                            className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: C.muted }}
                          >
                            Monthly Revenue vs Net Release
                          </p>
                          <p
                            className="text-[9px] mt-0.5"
                            style={{ color: C.subtle }}
                          >
                            Bars = revenue earned · Line = cash released
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-md"
                          style={{
                            background:
                              analytics.moGrowth >= 0 ? C.greenDim : C.redDim,
                            color:
                              analytics.moGrowth >= 0 ? "#4ade80" : "#f87171",
                          }}
                        >
                          {analytics.moGrowth >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(analytics.moGrowth)}% MoM
                        </span>
                      </div>
                      <RevenueTrendChart
                        months={analytics.months}
                        revenueByMonth={analytics.revenueByMonth}
                        netReleaseByMonth={analytics.netReleaseByMonth}
                      />
                    </div>

                    <div
                      className="rounded-xl p-5"
                      style={{
                        background: C.surfaceHigh,
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      <p
                        className="text-[10px] font-black uppercase tracking-widest mb-4"
                        style={{ color: C.muted }}
                      >
                        Revenue by Loan Type
                      </p>
                      <LoanTypeBreakdown batch={analytics.batch} />

                      {/* Top performer */}
                      {(() => {
                        const top = (
                          [
                            "NEW",
                            "RENEWAL",
                            "EXTENSION",
                            "SUKLILOAN",
                          ] as LoanType[]
                        )
                          .map((t) => ({
                            type: t,
                            ...(analytics.batch.byType[t] ?? {
                              count: 0,
                              revenue: 0,
                              netRelease: 0,
                            }),
                          }))
                          .sort((a, b) => b.revenue - a.revenue)[0];
                        if (!top || top.revenue === 0) return null;
                        return (
                          <div
                            className="mt-5 p-3 rounded-lg"
                            style={{ background: C.surfaceMid }}
                          >
                            <p
                              className="text-[9px] uppercase tracking-widest"
                              style={{ color: C.muted }}
                            >
                              Top Performer
                            </p>
                            <p
                              className="text-sm font-black mt-0.5"
                              style={{ color: LOAN_COLOR[top.type] }}
                            >
                              {top.type}
                            </p>
                            <p className="text-xs" style={{ color: C.text }}>
                              {pesoK(top.revenue)} · {top.count} loans
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Eligibility summary */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      {
                        label: "Renewal Ready",
                        count: analytics.renewalEligible.length,
                        desc: "≥50% term paid",
                        color: C.gold,
                      },
                      {
                        label: "Extension Ready",
                        count: analytics.extensionEligible.length,
                        desc: "3+ months, active",
                        color: C.red,
                      },
                      {
                        label: "Sukli Available",
                        count: analytics.sukliEligible.length,
                        desc: "Change ≥ ₱1,000",
                        color: C.blue,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-xl px-5 py-4"
                        style={{
                          background: C.surfaceHigh,
                          border: `1px solid ${C.border}`,
                          borderLeft: `3px solid ${s.color}`,
                        }}
                      >
                        <p
                          className="text-[9px] font-black uppercase tracking-widest mb-1"
                          style={{ color: C.muted }}
                        >
                          {s.label}
                        </p>
                        <p
                          className="text-4xl font-black leading-none mb-1"
                          style={{ color: s.color }}
                        >
                          {s.count}
                        </p>
                        <p className="text-[9px]" style={{ color: C.muted }}>
                          {s.desc}
                        </p>
                        <div
                          className="mt-3 h-0.5 rounded-full overflow-hidden"
                          style={{ background: C.surfaceMid }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${analytics.totalClients > 0 ? Math.round((s.count / analytics.totalClients) * 100) : 0}%`,
                              background: s.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── PROFIT DETAIL TAB ──────────────────────────────────── */}
              {tab === "profit" && (
                <>
                  {/* Toolbar */}
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-t-xl"
                    style={{
                      background: C.surfaceHigh,
                      border: `1px solid ${C.border}`,
                      borderBottom: `1px solid ${C.borderSub}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <p
                        className="text-sm font-black"
                        style={{ color: C.text }}
                      >
                        Profit Breakdown
                      </p>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: C.surfaceMid, color: C.muted }}
                      >
                        {filteredRows.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-0.5 p-0.5 rounded-lg"
                        style={{ background: C.surfaceMid }}
                      >
                        {FILTERS.map((f) => (
                          <button
                            key={f.key}
                            onClick={() => setLoanFilter(f.key)}
                            className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
                            style={
                              loanFilter === f.key
                                ? { background: C.gold, color: C.bg }
                                : { color: C.muted }
                            }
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <span
                          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
                          style={{ color: C.muted }}
                        >
                          ⌕
                        </span>
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search clients..."
                          className="pl-8 pr-4 py-2 text-xs rounded-lg w-48 focus:outline-none transition-all"
                          style={{
                            background: C.surfaceMid,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className="rounded-b-xl overflow-hidden"
                    style={{
                      border: `1px solid ${C.border}`,
                      borderTop: "none",
                    }}
                  >
                    <table
                      className="w-full text-sm"
                      style={{ background: C.surfaceHigh }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: `1px solid ${C.border}`,
                            background: C.surface,
                          }}
                        >
                          {[
                            "Client",
                            "Type",
                            "Principal",
                            "Net Release",
                            "Revenue (Breakdown)",
                            "Remaining",
                            "Eligible",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-[9px] font-black tracking-widest uppercase"
                              style={{ color: C.muted }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-16 text-center text-xs"
                              style={{ color: C.muted }}
                            >
                              No clients match.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((item) => (
                            <ProfitRow key={item.client._id} item={item} />
                          ))
                        )}
                      </tbody>
                    </table>

                    {filteredRows.length > 0 && (
                      <div
                        className="flex justify-between items-center px-4 py-2.5"
                        style={{
                          background: C.surface,
                          borderTop: `1px solid ${C.borderSub}`,
                        }}
                      >
                        <p className="text-[10px]" style={{ color: C.muted }}>
                          <span style={{ color: C.text, fontWeight: 700 }}>
                            {filteredRows.length}
                          </span>{" "}
                          records
                        </p>
                        <p className="text-[10px]" style={{ color: C.muted }}>
                          Filtered Revenue:{" "}
                          <span style={{ color: C.gold, fontWeight: 700 }}>
                            {pesoK(
                              filteredRows.reduce(
                                (s, r) => s + (r.computation?.revenue ?? 0),
                                0,
                              ),
                            )}
                          </span>{" "}
                          · Net Release:{" "}
                          <span style={{ color: C.green, fontWeight: 700 }}>
                            {pesoK(
                              filteredRows.reduce(
                                (s, r) => s + (r.computation?.netRelease ?? 0),
                                0,
                              ),
                            )}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── OPPORTUNITIES TAB ──────────────────────────────────── */}
              {tab === "opportunities" && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <KpiCard
                      label="Pipeline Revenue Est."
                      value={pesoK(analytics.pipelineRevenue)}
                      sub="from all eligible clients"
                      accent={C.gold}
                      icon="◎"
                    />
                    <KpiCard
                      label="Multi-Eligible"
                      value={String(
                        analytics.eligible.filter(
                          (d) =>
                            [d.canRenew, d.canExtend, d.canSukli].filter(
                              Boolean,
                            ).length > 1,
                        ).length,
                      )}
                      sub="clients with 2+ options"
                      accent={C.red}
                      icon="⚡"
                    />
                    <KpiCard
                      label="Conversion Rate"
                      value={
                        analytics.totalClients > 0
                          ? `${Math.round((analytics.eligible.length / analytics.totalClients) * 100)}%`
                          : "—"
                      }
                      sub="eligible / total"
                      accent={C.green}
                      icon="→"
                    />
                  </div>

                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${C.border}` }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{
                        background: C.surfaceHigh,
                        borderBottom: `1px solid ${C.borderSub}`,
                      }}
                    >
                      <p
                        className="text-sm font-black"
                        style={{ color: C.text }}
                      >
                        Eligible Clients
                      </p>
                      <div className="relative">
                        <span
                          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
                          style={{ color: C.muted }}
                        >
                          ⌕
                        </span>
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search..."
                          className="pl-8 pr-4 py-2 text-xs rounded-lg w-44 focus:outline-none"
                          style={{
                            background: C.surfaceMid,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="flex flex-col gap-2 p-4"
                      style={{ background: C.surfaceHigh }}
                    >
                      {eligibleFiltered.length === 0 ? (
                        <p
                          className="text-center py-12 text-xs"
                          style={{ color: C.muted }}
                        >
                          No eligible clients found.
                        </p>
                      ) : (
                        eligibleFiltered.map((item) => {
                          const c = item.client;
                          const estRevenue =
                            item.computation?.revenue ?? analytics.avgRevenue;
                          const tags: { label: string; color: string }[] = [];
                          if (item.canRenew)
                            tags.push({ label: "RENEWAL", color: C.gold });
                          if (item.canExtend)
                            tags.push({ label: "EXTENSION", color: C.red });
                          if (item.canSukli)
                            tags.push({ label: "SUKLI", color: C.blue });

                          return (
                            <div
                              key={c._id}
                              className="flex items-center gap-4 px-4 py-3 rounded-xl"
                              style={{
                                background: C.surfaceMid,
                                border: `1px solid ${C.borderSub}`,
                              }}
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0"
                                style={{ background: C.surface, color: C.gold }}
                              >
                                {c.pensionType?.slice(0, 3).toUpperCase() ??
                                  "CLT"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-xs font-semibold uppercase truncate"
                                  style={{ color: C.text }}
                                >
                                  {c.lastName}, {c.firstName}{" "}
                                  {c.middleName ?? ""}
                                </p>
                                <p
                                  className="text-[10px]"
                                  style={{ color: C.muted }}
                                >
                                  {c.pensionType ?? "—"} ·{" "}
                                  {item.remainingMonths} mos remaining
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                {tags.map((t) => (
                                  <span
                                    key={t.label}
                                    className="text-[9px] font-black px-1.5 py-0.5 rounded"
                                    style={{
                                      background: t.color + "22",
                                      color: t.color,
                                      border: `1px solid ${t.color}44`,
                                    }}
                                  >
                                    {t.label}
                                  </span>
                                ))}
                              </div>
                              <div className="text-right shrink-0">
                                <p
                                  className="text-xs font-black"
                                  style={{ color: C.gold }}
                                >
                                  ~{pesoK(estRevenue)}
                                </p>
                                <p
                                  className="text-[9px]"
                                  style={{ color: C.muted }}
                                >
                                  est. revenue
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {eligibleFiltered.length > 0 && (
                      <div
                        className="flex justify-between items-center px-4 py-2.5"
                        style={{
                          background: C.surface,
                          borderTop: `1px solid ${C.borderSub}`,
                        }}
                      >
                        <p className="text-[10px]" style={{ color: C.muted }}>
                          <span style={{ color: C.text, fontWeight: 700 }}>
                            {eligibleFiltered.length}
                          </span>{" "}
                          eligible clients
                        </p>
                        <p className="text-[10px]" style={{ color: C.muted }}>
                          Estimated pipeline:{" "}
                          <span style={{ color: C.gold, fontWeight: 700 }}>
                            {pesoK(
                              eligibleFiltered.reduce(
                                (s, d) =>
                                  s +
                                  (d.computation?.revenue ??
                                    analytics.avgRevenue),
                                0,
                              ),
                            )}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
