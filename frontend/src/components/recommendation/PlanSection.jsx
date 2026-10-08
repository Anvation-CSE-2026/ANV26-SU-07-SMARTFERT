import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";
import { RangeBar } from "../common/RangeBar";
import { PriorityMixer } from "../input/PriorityMixer";
import { useAppStore } from "../../store/useAppStore";
import { rankPlans, whyTopPick } from "../../utils/scoring";
import { objectiveLabelKey, fmtCurrency } from "../../utils/format";

const NUTRIENT_LABEL_KEY = { N: "input.nitrogen", P: "input.phosphorus", K: "input.potassium" };

export function PlanSection({ result }) {
  const { t } = useTranslation();
  const mixer = useAppStore((s) => s.mixer);
  const [showMixer, setShowMixer] = useState(false);
  const [manualTab, setManualTab] = useState(null);

  const ranked = useMemo(() => rankPlans(result, mixer), [result, mixer]);
  const topObjective = ranked[0]?.plan.objective;
  const activeObjective = manualTab || topObjective;
  const activeEntry = ranked.find((r) => r.plan.objective === activeObjective) || ranked[0];
  const activePlan = activeEntry?.plan;

  return (
    <Card>
      <CardHeader
        title={t("recommendation.howToFixTitle")}
        icon="🧪"
        action={
          <button onClick={() => setShowMixer((s) => !s)} className="text-xs font-medium text-green-700 hover:underline">
            {t("input.mixerTitle")}
          </button>
        }
      />
      <CardBody>
        {showMixer && (
          <div className="mb-5 bg-mint-50 rounded-xl p-4">
            <PriorityMixer />
          </div>
        )}

        <p className="text-sm font-medium text-green-900 mb-2">{t("recommendation.doseRangeLabel")}</p>
        <div className="space-y-4 mb-5">
          {["N", "P", "K"].map((nut) => (
            <div key={nut}>
              <div className="flex justify-between text-xs text-green-700/70 mb-1">
                <span className="font-medium text-green-900">{t(NUTRIENT_LABEL_KEY[nut])}</span>
                <span>
                  {t("recommendation.safeCapLabel")}: {result.dose[nut].cap} kg/ha
                </span>
              </div>
              <RangeBar low={result.dose[nut].low} high={result.dose[nut].high} point={result.dose[nut].point} cap={result.dose[nut].cap} unit=" kg/ha" />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-1 overflow-x-auto pb-1">
          {ranked.map(({ plan }) => (
            <button
              key={plan.objective}
              onClick={() => setManualTab(plan.objective)}
              className={`shrink-0 text-sm px-3 py-2 rounded-xl border font-medium transition-colors ${
                plan.objective === activeObjective ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"
              }`}
            >
              {t(objectiveLabelKey(plan.objective))}
              {plan.objective === topObjective && (
                <span className="ml-1.5 text-[10px] opacity-80">★ {t("recommendation.topPick")}</span>
              )}
            </button>
          ))}
        </div>

        {activeObjective === topObjective && (
          <p className="text-xs text-green-700/70 mb-3 italic">{whyTopPick(ranked, mixer)}</p>
        )}

        {activePlan && (
          <div className="rounded-xl border border-green-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-mint-50 text-green-800">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t("recommendation.itemsHeader")}</th>
                  <th className="text-right px-3 py-2 font-medium">{t("recommendation.doseHeader")}</th>
                  <th className="text-right px-3 py-2 font-medium">{t("recommendation.costHeader")}</th>
                </tr>
              </thead>
              <tbody>
                {activePlan.items.map((item, i) => (
                  <tr key={i} className="border-t border-green-50">
                    <td className="px-3 py-2 text-green-900">{item.fertilizer}</td>
                    <td className="px-3 py-2 text-right">{item.kg_per_ha}</td>
                    <td className="px-3 py-2 text-right">₹{item.cost_rs}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-green-200 bg-mint-50">
                  <td className="px-3 py-2 font-semibold text-green-900">{t("recommendation.totalCost")}</td>
                  <td />
                  <td className="px-3 py-2 text-right font-semibold text-green-900">{fmtCurrency(activePlan.cost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Badge tone="mint">🌿 {t("recommendation.sustainabilityCardTitle")}: {activePlan?.sustainability_score}/100</Badge>
          <Badge tone="gray">💨 {activePlan?.ghg_kg_co2e_ha} kg CO2e/ha</Badge>
        </div>

        {result.price_alternative && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            💡 {t("recommendation.priceAlternativeNote")} — <strong>{t(objectiveLabelKey(result.price_alternative.objective))}</strong>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
