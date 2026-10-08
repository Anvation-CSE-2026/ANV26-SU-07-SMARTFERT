import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { api } from "../../api/client";
import { cropLabel } from "../../utils/format";

function buildClientSummary(scenarios, t) {
  const points = [];
  const crops = new Set(scenarios.map((s) => cropLabel(t, s.input.crop)));
  if (crops.size > 1) points.push(`Crops differ (${[...crops].join(", ")}), which changes nutrient needs.`);
  const districts = new Set(scenarios.map((s) => s.input.district));
  if (districts.size > 1) points.push(`Locations differ (${[...districts].join(", ")}), so weather and prices differ.`);
  const objectives = new Set(scenarios.map((s) => s.result.plan.objective));
  if (objectives.size > 1) points.push(`Chosen plans differ (${[...objectives].join(", ")}), reflecting different priorities.`);
  if (!points.length) points.push("These scenarios were quite similar — differences mainly come from minor weather or price variation.");
  return points;
}

export function WhyDifferentCard({ scenarios }) {
  const { t } = useTranslation();
  const [points, setPoints] = useState([]);

  useEffect(() => {
    if (scenarios.length === 2) {
      api.postCompare(scenarios[0].result, scenarios[1].result).then(({ data }) => setPoints(data.why_it_changed));
    } else {
      setPoints(buildClientSummary(scenarios, t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios.map((s) => s.id).join(",")]);

  return (
    <Card>
      <CardHeader title={t("comparison.whyDifferentTitle")} icon="💬" />
      <CardBody>
        <ul className="space-y-2 text-sm text-green-800">
          {points.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
