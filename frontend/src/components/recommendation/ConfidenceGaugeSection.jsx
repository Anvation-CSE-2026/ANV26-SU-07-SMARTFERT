import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";

const COMPONENT_LABEL_KEY = {
  data_quality: "confidenceGauge.dataQuality",
  model_agreement: "confidenceGauge.modelAgreement",
  interval_tightness: "confidenceGauge.intervalTightness",
  in_distribution: "confidenceGauge.inDistribution",
  feedback_support: "confidenceGauge.feedbackSupport",
  satellite_agreement: "confidenceGauge.satelliteAgreement",
};

const BAND_TONE = { High: "green", Medium: "amber", Low: "amber" };

export function ConfidenceGaugeSection({ confidence }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!confidence) return null;

  const { score, band, components, how_to_improve = [], synthetic_model_note } = confidence;
  const color = band === "High" ? "var(--color-green-600)" : band === "Medium" ? "var(--color-amber-500)" : "#dc2626";

  return (
    <Card className={band !== "High" ? "border-amber-200" : ""}>
      <CardHeader
        title={t("confidenceGauge.title")}
        icon="🎯"
        action={<Badge tone={BAND_TONE[band]}>{t(`confidenceGauge.band${band}`)}</Badge>}
      />
      <CardBody>
        <p className="text-sm text-green-800 mb-1">{t(`confidenceGauge.meaning${band}`)}</p>
        {synthetic_model_note && (
          <p className="text-xs text-amber-700 mb-3">🧪 {t("confidenceGauge.syntheticModelNote")}</p>
        )}

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-green-900">{t("confidenceGauge.score")}</span>
            <span className="text-green-700/70">{score}/100</span>
          </div>
          <div className="h-3 rounded-full bg-green-50 border border-green-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {Object.entries(components)
            .filter(([, v]) => v != null)
            .map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between text-xs text-green-700/70 mb-0.5">
                  <span>{t(COMPONENT_LABEL_KEY[key])}</span>
                  <span>{Math.round(value * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-green-50 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            ))}
        </div>

        {how_to_improve.length > 0 && (
          <div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-sm font-medium text-green-700 hover:underline flex items-center gap-1"
              aria-expanded={open}
            >
              <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
              {t("confidenceGauge.howToRaise")}
            </button>
            {open && (
              <ul className="mt-2 space-y-1 text-sm text-green-800 list-disc list-inside">
                {how_to_improve.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-[11px] text-green-700/50 mt-3">{t("confidenceGauge.note")}</p>
      </CardBody>
    </Card>
  );
}
