import { useTranslation } from "react-i18next";
import { Card, CardBody } from "../common/Card";
import { fmtCurrency } from "../../utils/format";

export function SeasonSummary({ items }) {
  const { t } = useTranslation();
  const costs = items.map((i) => i.cost).filter((v) => v != null);
  const sus = items.map((i) => i.sustainability).filter((v) => v != null);
  const conf = items.map((i) => i.confidence).filter((v) => v != null);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  const stats = [
    { label: t("season.totalCost"), value: costs.length ? fmtCurrency(costs.reduce((a, b) => a + b, 0)) : "—" },
    { label: t("season.avgSustainability"), value: avg(sus) != null ? `${avg(sus)}/100` : "—" },
    { label: t("season.avgConfidence"), value: avg(conf) != null ? `${avg(conf)}/100` : "—" },
    { label: t("season.recommendationCount"), value: items.length },
  ];

  return (
    <Card>
      <CardBody className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="text-center bg-mint-50 rounded-xl p-3">
            <p className="text-lg font-semibold text-green-900">{s.value}</p>
            <p className="text-[11px] text-green-700/60 mt-0.5">{s.label}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
