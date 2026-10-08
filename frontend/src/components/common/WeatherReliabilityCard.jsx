import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "./Card";
import { Badge } from "./Badge";

const LEVEL_COLOR = { high: "var(--color-green-600)", moderate: "var(--color-amber-500)", low: "#dc2626" };
const LEVEL_EMOJI = { high: "🟢", moderate: "🟡", low: "🔴" };
const LEVEL_TONE = { high: "green", moderate: "amber", low: "amber" };

function SourceRow({ label, value, isHistorical }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-green-50 last:border-0">
      <span className={`text-sm ${isHistorical ? "text-green-700/70 italic" : "text-green-900 font-medium"}`}>{label}</span>
      <span className="text-sm font-semibold text-green-900">{value}%</span>
    </div>
  );
}

// `compact` drops the conflicts list and source-by-source rows, for use
// inside tighter spaces like the Explain timeline.
export function WeatherReliabilityCard({ reliability, compact = false }) {
  const { t } = useTranslation();
  if (!reliability) return null;
  const { sources, historical, blended, confidence, recommendation_note } = reliability;
  const level = confidence.level;

  return (
    <Card className={level !== "high" ? "border-amber-200" : ""}>
      <CardHeader
        title={t("weatherReliability.title")}
        icon="🌦️"
        action={
          <Badge tone={LEVEL_TONE[level]}>
            {LEVEL_EMOJI[level]} {t(`weatherReliability.level${level[0].toUpperCase()}${level.slice(1)}`)}
          </Badge>
        }
      />
      <CardBody>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center shrink-0">
            <div className="text-2xl font-semibold text-green-900">{blended.rain_probability_pct}%</div>
            <div className="text-[11px] text-green-700/60">{t("weatherReliability.rainPrediction")}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs text-green-700/70 mb-1">
              <span>{t("weatherReliability.confidence")}</span>
              <span className="font-medium text-green-900">{confidence.score}/100</span>
            </div>
            <div className="h-3 rounded-full bg-green-50 border border-green-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${confidence.score}%`, backgroundColor: LEVEL_COLOR[level] }}
              />
            </div>
          </div>
        </div>

        {!compact && (
          <div className="mb-3">
            {sources.map((s) => (
              <SourceRow key={s.name} label={s.name} value={s.rain_probability_pct} />
            ))}
            <SourceRow label={historical.name} value={historical.rain_probability_pct} isHistorical />
          </div>
        )}

        {confidence.conflicts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-sm font-medium text-amber-800 mb-1">
              ⚠️ {t("weatherReliability.uncertaintyDetected")}
            </p>
            {!compact && (
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                {confidence.conflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="bg-mint-50 border border-green-100 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold text-green-800 mb-0.5">{t("weatherReliability.aiRecommendation")}</p>
          <p className="text-sm text-green-800">{recommendation_note}</p>
        </div>

        <p className="text-[11px] text-green-700/50 mt-2">{t("weatherReliability.demoNote")}</p>
      </CardBody>
    </Card>
  );
}
