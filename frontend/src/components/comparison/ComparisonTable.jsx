import { useTranslation } from "react-i18next";
import { Card, CardBody } from "../common/Card";
import { objectiveLabelKey, fmtCurrency, fmtRange } from "../../utils/format";

export function ComparisonTable({ scenarios }) {
  const { t } = useTranslation();

  const rows = [
    { labelKey: "comparison.crop", get: (sc) => t(`crops.${sc.input.crop}`) },
    { labelKey: "comparison.soilRatings", get: (sc) => `N:${sc.result.soil_rating.N} P:${sc.result.soil_rating.P} K:${sc.result.soil_rating.K}` },
    { labelKey: "comparison.plan", get: (sc) => t(objectiveLabelKey(sc.result.plan.objective)) },
    { labelKey: "comparison.cost", get: (sc) => fmtCurrency(sc.result.plan.cost) },
    { labelKey: "comparison.yieldRange", get: (sc) => `${fmtRange(sc.result.yield_estimate.low_t_ha, sc.result.yield_estimate.high_t_ha)} t/ha` },
    { labelKey: "comparison.risk", get: (sc) => `${sc.result.risk.score}/100` },
    { labelKey: "comparison.sustainabilityCol", get: (sc) => `${sc.result.sustainability.score}/100` },
    { labelKey: "comparison.emissionsCol", get: (sc) => `${sc.result.sustainability.ghg_kg_co2e_ha} kg` },
  ];

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-green-700/70 font-medium"> </th>
              {scenarios.map((sc) => (
                <th key={sc.id} className="text-left px-3 py-2 font-semibold text-green-900">
                  {sc.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = scenarios.map((sc) => row.get(sc));
              const differs = new Set(values).size > 1;
              return (
                <tr key={row.labelKey} className={`border-t border-green-50 ${differs ? "bg-amber-50/60" : ""}`}>
                  <td className="px-3 py-2 font-medium text-green-800">{t(row.labelKey)}</td>
                  {values.map((v, i) => (
                    <td key={i} className="px-3 py-2 text-green-900">
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-amber-700 mt-2">🟧 {t("comparison.whatDiffers")}</p>
      </CardBody>
    </Card>
  );
}
