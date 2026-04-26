// /components/StatusBadge.tsx

export default function StatusBadge({
  eligibleMonths,
}: {
  eligibleMonths: number;
}) {
  const isEligible = eligibleMonths > 0;

  return (
    <span
      className={`px-2 py-1 text-[10px] rounded-sm font-semibold
      ${
        isEligible ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"
      }`}
    >
      {isEligible ? "Eligible" : "Not Eligible"}
    </span>
  );
}
