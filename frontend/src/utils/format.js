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

// Crop ids are lowercase everywhere in this app, but data that passed through
// the real backend (or a reused history item) may carry Title Case ("Rice").
// Translate defensively rather than ever showing a raw "crops.xxx" i18n key.
export function cropLabel(t, crop) {
  if (!crop) return crop;
  return t(`crops.${crop.toLowerCase()}`, { defaultValue: crop });
}

export function objectiveLabelKey(objective) {
  if (objective === "cheapest") return "recommendation.cheapest";
  if (objective === "eco_inm") return "recommendation.ecoMix";
  return "recommendation.balancedOrganic";
}
