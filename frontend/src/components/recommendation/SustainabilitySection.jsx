import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";
import { objectiveLabelKey } from "../../utils/format";

function Metric({ label, value, meaning }) {
  return (
    <div className="bg-mint-50 rounded-xl p-3">
      <p className="text-xs text-green-700/70">{label}</p>
      <p className="text-lg font-semibold text-green-900">{value}</p>
      <p className="text-[11px] text-green-700/60 mt-0.5">{meaning}</p>
    </div>
  );
}

function meaningKeyFor(band) {
  if (band === "Good") return "recommendation.sustainabilityMeaningGood";
  if (band === "Moderate") return "recommendation.sustainabilityMeaningModerate";
  return "recommendation.sustainabilityMeaningNeedsImprovement";
}

// Simple what-if: compare the chosen plan against whichever alternative
// scores highest, and whichever cuts emissions most, so "how to improve"
// shows concrete, computed numbers rather than generic advice.
function buildImprovements(t, plan, alternatives) {
  const others = Object.values(alternatives || {});
  if (!plan || !others.length) return [];
  const tips = [];
  const betterScore = others
    .filter((p) => p.sustainability_score > plan.sustainability_score)
    .sort((a, b) => b.sustainability_score - a.sustainability_score)[0];
  if (betterScore) {
    tips.push(
      t("recommendation.improveSwitchScore", {
        plan: t(objectiveLabelKey(betterScore.objective)),
        from: plan.sustainability_score,
        to: betterScore.sustainability_score,
      })
    );
  }
  const lowerEmissions = others
    .filter((p) => p.ghg_kg_co2e_ha < plan.ghg_kg_co2e_ha)
    .sort((a, b) => a.ghg_kg_co2e_ha - b.ghg_kg_co2e_ha)[0];
  if (lowerEmissions && lowerEmissions !== betterScore) {
    const cutPct = Math.round((1 - lowerEmissions.ghg_kg_co2e_ha / Math.max(plan.ghg_kg_co2e_ha, 1)) * 100);
    if (cutPct > 0) {
      tips.push(
        t("recommendation.improveCutEmissions", { plan: t(objectiveLabelKey(lowerEmissions.objective)), pct: cutPct })
      );
    }
  }
  return tips;
}

export function SustainabilitySection({ sustainability, plan, alternatives }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const s = sustainability;
  const bandTone = s.band === "Good" ? "green" : s.band === "Moderate" ? "amber" : "gray";
  const improvements = buildImprovements(t, plan, alternatives);

  return (
    <Card>
      <CardHeader
        title={t("recommendation.sustainabilityCardTitle")}
        icon="🌍"
        action={<Badge tone={bandTone}>{s.band}</Badge>}
      />
      <CardBody>
        <p className="text-sm text-green-800 mb-3">{t(meaningKeyFor(s.band))}</p>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-green-900">{t("recommendation.scoreLabel")}</span>
            <span className="text-green-700/70">{s.score}/100</span>
          </div>
          <div className="h-3 rounded-full bg-green-50 border border-green-100 overflow-hidden">
            <div className="h-full rounded-full bg-green-600" style={{ width: `${s.score}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Metric
            label={t("recommendation.nutrientUseEfficiency")}
            value={`${Math.round(s.nutrient_use_efficiency * 100)}%`}
            meaning={t("recommendation.nutrientUseEfficiencyMeaning")}
          />
          <Metric
            label={t("recommendation.emissions")}
            value={`${s.ghg_kg_co2e_ha} kg`}
            meaning={t("recommendation.emissionsMeaning")}
          />
          <Metric
            label={t("recommendation.surplus")}
            value={`${s.surplus_kg_ha} kg/ha`}
            meaning={t("recommendation.surplusMeaning")}
          />
          <Metric label={t("recommendation.balancedOrganic")} value={`${s.balanced_score}/100`} meaning="" />
        </div>

        {improvements.length > 0 && (
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
                {improvements.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
