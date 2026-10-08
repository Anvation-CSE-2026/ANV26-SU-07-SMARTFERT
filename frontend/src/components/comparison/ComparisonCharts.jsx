import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Card, CardHeader, CardBody } from "../common/Card";

const PALETTE = ["#2E7D32", "#5aab61", "#c98a1f", "#3b82f6"];

export function ComparisonCharts({ scenarios }) {
  const { t } = useTranslation();

  const doseData = ["N", "P", "K"].map((nut) => {
    const row = { nutrient: nut };
    scenarios.forEach((sc) => {
      row[sc.name] = sc.result.dose[nut].point;
    });
    return row;
  });

  const costData = scenarios.map((sc) => ({ name: sc.name, cost: sc.result.plan.cost }));

  const sustainabilityData = [
    { metric: "Sustainability", ...Object.fromEntries(scenarios.map((sc) => [sc.name, sc.result.sustainability.score])) },
    { metric: "NUE %", ...Object.fromEntries(scenarios.map((sc) => [sc.name, Math.round(sc.result.sustainability.nutrient_use_efficiency * 100)])) },
    { metric: "Low emissions", ...Object.fromEntries(scenarios.map((sc) => [sc.name, Math.max(0, 100 - sc.result.sustainability.ghg_kg_co2e_ha)])) },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title={t("comparison.doseChart")} icon="🧪" />
        <CardBody className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={doseData}>
              <CartesianGrid vertical={false} stroke="var(--color-green-100)" />
              <XAxis dataKey="nutrient" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {scenarios.map((sc, i) => (
                <Bar key={sc.id} dataKey={sc.name} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("comparison.costChart")} icon="💰" />
        <CardBody className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costData}>
              <CartesianGrid vertical={false} stroke="var(--color-green-100)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v) => `₹${v}`} />
              <Bar dataKey="cost" fill="var(--color-green-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("comparison.yieldChart")} icon="📈" />
        <CardBody className="space-y-3">
          {scenarios.map((sc, i) => {
            const y = sc.result.yield_estimate;
            const maxHigh = Math.max(...scenarios.map((s) => s.result.yield_estimate.high_t_ha));
            return (
              <div key={sc.id}>
                <div className="flex justify-between text-xs text-green-800 mb-1">
                  <span style={{ color: PALETTE[i % PALETTE.length] }} className="font-medium">
                    {sc.name}
                  </span>
                  <span>
                    {y.low_t_ha}–{y.high_t_ha} t/ha
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-green-50 border border-green-100 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 rounded-full"
                    style={{
                      left: `${(y.low_t_ha / maxHigh) * 100}%`,
                      width: `${((y.high_t_ha - y.low_t_ha) / maxHigh) * 100}%`,
                      backgroundColor: PALETTE[i % PALETTE.length],
                      opacity: 0.8,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("comparison.sustainabilityChart")} icon="🌍" />
        <CardBody className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={sustainabilityData}>
              <PolarGrid stroke="var(--color-green-100)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} angle={30} domain={[0, 100]} />
              {scenarios.map((sc, i) => (
                <Radar
                  key={sc.id}
                  name={sc.name}
                  dataKey={sc.name}
                  stroke={PALETTE[i % PALETTE.length]}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity={0.25}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  );
}
