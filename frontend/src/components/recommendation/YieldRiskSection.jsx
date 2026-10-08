import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardHeader, CardBody } from "../common/Card";
import { fmtRange } from "../../utils/format";

function RiskGauge({ score, warning }) {
  const { t } = useTranslation();
  const color = warning ? "var(--color-amber-500)" : "var(--color-green-600)";
  const label = score > 70 ? t("recommendation.riskHigh") : score > 40 ? t("recommendation.riskMedium") : t("recommendation.riskLow");
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-green-900">{label}</span>
        <span className="text-green-700/70">{score}/100</span>
      </div>
      <div className="h-3 rounded-full bg-green-50 border border-green-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function YieldRiskSection({ result }) {
  const { t } = useTranslation();
  const y = result.yield_estimate;
  const whatIfData = [
    { name: t("recommendation.whatIfMinus"), value: y.what_if_point_t_ha["N-20%"] },
    { name: t("recommendation.whatIfCurrent"), value: y.what_if_point_t_ha.current },
    { name: t("recommendation.whatIfPlus"), value: y.what_if_point_t_ha["N+20%"] },
  ];

  return (
    <Card>
      <CardHeader title={t("recommendation.ifApplyNowTitle")} icon="📈" />
      <CardBody>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-mint-50 rounded-xl p-3 text-center">
            <p className="text-xs text-green-700/70">{t("recommendation.withoutFertilizer")}</p>
            <p className="text-lg font-semibold text-green-900">{y.without_fertilizer_t_ha} t/ha</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-green-700/70">{t("recommendation.estimatedYieldRange")}</p>
            <p className="text-lg font-semibold text-green-900">{fmtRange(y.low_t_ha, y.high_t_ha)} t/ha</p>
            <p className="text-xs text-green-700/60">+{y.expected_gain_t_ha} t/ha {t("recommendation.expectedGain").toLowerCase()}</p>
          </div>
        </div>

        <p className="text-sm font-medium text-green-900 mb-2">{t("recommendation.whatIfTitle")}</p>
        <div className="h-44 mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={whatIfData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid vertical={false} stroke="var(--color-green-100)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#2E7D32" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#2E7D32" }} axisLine={false} tickLine={false} width={36} />
              <Tooltip formatter={(v) => `${v} t/ha`} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-green-200)" }} />
              <Bar dataKey="value" fill="var(--color-green-500)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-sm font-medium text-green-900 mb-2">{t("recommendation.riskTitle")}</p>
        <RiskGauge score={result.risk.score} warning={result.risk.warning} />
        {result.risk.warning && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            🧪 {t("recommendation.riskWarningNote")}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
