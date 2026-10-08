const TONES = {
  green: "bg-green-100 text-green-800",
  mint: "bg-mint-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  gray: "bg-gray-100 text-gray-600",
  white: "bg-white text-green-700 border border-green-200",
};

export function Badge({ children, tone = "green", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function TrafficLightChip({ level, label }) {
  const toneMap = { low: "amber", medium: "gray", high: "green" };
  const dotMap = { low: "bg-amber-500", medium: "bg-gray-400", high: "bg-green-600" };
  return (
    <Badge tone={toneMap[level] || "gray"}>
      <span className={`w-2 h-2 rounded-full ${dotMap[level] || "bg-gray-400"}`} />
      {label}
    </Badge>
  );
}
