// Visualises a low-high dose range against a safe upper cap.
// value marks the recommended point dose; cap is the safe limit (100% of track).
export function RangeBar({ low, high, point, cap, unit = "" }) {
  const safeCap = cap > 0 ? cap : Math.max(high, 1);
  const pct = (n) => Math.min(100, (n / safeCap) * 100);
  return (
    <div className="w-full">
      <div className="relative h-3 rounded-full bg-green-50 border border-green-100 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-green-200"
          style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-green-700"
          style={{ left: `${pct(point)}%` }}
          title={`Suggested: ${point}${unit}`}
        />
        <div className="absolute top-0 bottom-0 right-0 w-0.5 bg-amber-500" title={`Safe cap: ${safeCap}${unit}`} />
      </div>
      <div className="flex justify-between text-[11px] text-green-700/70 mt-1">
        <span>
          {low}
          {unit}
        </span>
        <span className="font-medium text-green-800">
          {point}
          {unit}
        </span>
        <span>
          {high}
          {unit}
        </span>
      </div>
    </div>
  );
}
