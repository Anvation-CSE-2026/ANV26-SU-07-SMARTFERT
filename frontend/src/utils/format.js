export function fmtNum(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtCurrency(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function fmtRange(low, high, digits = 1) {
  return `${fmtNum(low, digits)}–${fmtNum(high, digits)}`;
}

export function objectiveLabelKey(objective) {
  if (objective === "cheapest") return "recommendation.cheapest";
  if (objective === "eco_inm") return "recommendation.ecoMix";
  return "recommendation.balancedOrganic";
}
