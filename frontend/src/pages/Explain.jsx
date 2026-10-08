import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { TrafficLightChip } from "../components/common/Badge";
import { DecisionStep } from "../components/explain/DecisionStep";
import { DriversChart } from "../components/explain/DriversChart";
import { WhatIfPanel } from "../components/explain/WhatIfPanel";
import { WeatherReliabilityCard } from "../components/common/WeatherReliabilityCard";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import { objectiveLabelKey } from "../utils/format";

const NUTRIENT_LABEL = { N: "Nitrogen", P: "Phosphorus", K: "Potassium" };

export default function Explain() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lastInput = useAppStore((s) => s.lastInput);
  const lastResult = useAppStore((s) => s.lastResult);
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    if (!lastResult) {
      navigate("/input");
      return;
    }
    api.getModelInfo().then(({ data }) => setModelInfo(data));
  }, [lastResult, navigate]);

  if (!lastResult) return null;
  const r = lastResult;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-semibold text-green-900 mb-1">{t("explain.title")}</h1>
      <p className="text-sm text-green-700/70 mb-6">{t("explain.subtitle")}</p>

      <div>
        <DecisionStep
          index={1}
          title={t("explain.step1Title")}
          description={t("explain.step1Desc")}
          visual={
            <div className="flex flex-wrap gap-2">
              {["N", "P", "K"].map((n) => (
                <TrafficLightChip key={n} level={r.soil_rating[n]} label={`${NUTRIENT_LABEL[n]}: ${r.soil_rating[n]}`} />
              ))}
            </div>
          }
          technical={`N cut-offs: low<280, medium<560 kg/ha\nP cut-offs: low<10, medium<24 kg/ha\nK cut-offs: low<108, medium<280 kg/ha\nYour values: N=${lastInput.N}, P=${lastInput.P}, K=${lastInput.K}`}
        />

        <DecisionStep
          index={2}
          title={t("explain.step2Title")}
          description={t("explain.step2Desc")}
          visual={
            r.cross_check_notes.length ? (
              <ul className="text-sm text-amber-700 list-disc list-inside space-y-0.5">
                {r.cross_check_notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-green-700">Weather signals and your soil report agreed.</p>
            )
          }
          technical={`early_warning_prior: ${JSON.stringify(r.early_warning_prior)}\nsoil_rating: ${JSON.stringify(r.soil_rating)}`}
        />

        <DecisionStep
          index={3}
          title={t("explain.step3Title")}
          description={t("explain.step3Desc")}
          visual={
            <ul className="text-sm text-green-800 list-disc list-inside space-y-0.5">
              {r.rule_trace.balance.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          }
        />

        <DecisionStep
          index={4}
          title={t("explain.step4Title")}
          description={t("explain.step4Desc")}
          visual={
            <div className="space-y-3">
              <ul className="text-sm text-green-800 list-disc list-inside space-y-0.5">
                {r.rule_trace.weather_and_trend_rules.length ? (
                  r.rule_trace.weather_and_trend_rules.map((w, i) => <li key={i}>{w}</li>)
                ) : (
                  <li>No significant weather adjustment was needed this time.</li>
                )}
              </ul>
              <WeatherReliabilityCard reliability={r.weather_reliability} compact />
            </div>
          }
          technical={`Safety limit: ±20% of base dose. Net weather_adjustment_pct applied: ${r.dose.N.weather_adjustment_pct}%`}
        />

        <DecisionStep
          index={5}
          title={t("explain.step5Title")}
          description={t("explain.step5Desc")}
          visual={
            <p className="text-sm text-green-800">
              {t("recommendation.riskTitle")}: <strong>{r.risk.score}/{r.risk.limit}</strong> — {r.risk.text}
            </p>
          }
          technical={`loop_back_tries: ${r.risk.loop_back_tries}`}
        />

        <DecisionStep
          index={6}
          title={t("explain.step6Title")}
          description={t("explain.step6Desc")}
          visual={
            <p className="text-sm text-green-800">
              {t("recommendation.topPick")}: <strong>{t(objectiveLabelKey(r.plan.objective))}</strong> — ₹{r.plan.cost}/ha,{" "}
              {r.plan.sustainability_score}/100 sustainability
            </p>
          }
          technical={`price_signals.urea.direction=${r.price_signals.urea.direction}, dap.direction=${r.price_signals.dap.direction}`}
        />

        <DecisionStep
          index={7}
          title={t("explain.step7Title")}
          description={t("explain.step7Desc")}
          visual={<DriversChart drivers={r.yield_estimate.drivers} />}
          technical={t("explain.technicalShap")}
        />

        <DecisionStep
          index={8}
          title={t("explain.step8Title")}
          description={t("explain.step8Desc")}
          visual={
            <p className="text-sm text-green-800">
              {r.sustainability.band} — {r.sustainability.score}/100 ({Math.round(r.sustainability.nutrient_use_efficiency * 100)}% efficiency,{" "}
              {r.sustainability.ghg_kg_co2e_ha} kg CO2e/ha)
            </p>
          }
        />

        <DecisionStep
          index={9}
          title={t("explain.step9Title")}
          description={t("explain.step9Desc")}
          visual={
            modelInfo && (
              <p className="text-sm text-green-800">
                {t("explain.confidenceInterval")}: {modelInfo.interval}. {t("explain.syntheticDataNote")}
              </p>
            )
          }
          technical={modelInfo ? JSON.stringify(modelInfo, null, 2) : ""}
        />
      </div>

      <WhatIfPanel baseInput={lastInput} baseResult={lastResult} />

      <div className="mt-5 no-print">
        <Button variant="ghost" onClick={() => navigate("/recommendation")}>
          ← {t("common.back")}
        </Button>
      </div>
    </div>
  );
}
