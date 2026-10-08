import { useTranslation } from "react-i18next";

export function EmptyState({ icon = "🌱", title, body, action }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-medium text-green-900">{title}</p>
      {body && <p className="text-sm text-green-700/70 mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function OfflineBanner({ show }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2 mb-4"
    >
      <span aria-hidden="true">⚠️</span>
      <span>{t("common.offlineNote")}</span>
    </div>
  );
}

export function Sparkline({ points, width = 80, height = 24, stroke = "var(--color-green-600)" }) {
  if (!points?.length) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - ((p - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrendArrow({ direction }) {
  if (direction === "up") return <span className="text-amber-600" aria-label="rising">▲</span>;
  if (direction === "down") return <span className="text-green-600" aria-label="falling">▼</span>;
  return <span className="text-gray-400" aria-label="stable">▬</span>;
}

export function Disclaimer() {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-green-700/70 bg-mint-50 border border-green-100 rounded-xl px-3 py-2.5 leading-relaxed">
      ℹ️ {t("common.estimateDisclaimer")}
    </p>
  );
}
