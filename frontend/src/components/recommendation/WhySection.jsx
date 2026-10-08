import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { TrafficLightChip } from "../common/Badge";

const NUTRIENT_LABEL_KEY = { N: "input.nitrogen", P: "input.phosphorus", K: "input.potassium" };

export function WhySection({ result }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader title={t("recommendation.whyTitle")} icon="🔍" />
      <CardBody>
        <div className="flex flex-wrap gap-3">
          {["N", "P", "K"].map((nut) => (
            <div key={nut} className="flex items-center gap-2">
              <span className="text-sm text-green-800 font-medium">{t(NUTRIENT_LABEL_KEY[nut])}</span>
              <TrafficLightChip level={result.soil_rating[nut]} label={t(`recommendation.${result.soil_rating[nut]}Label`)} />
            </div>
          ))}
        </div>

        {result.cross_check_notes?.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <p className="text-sm font-medium text-amber-800 mb-1">⚠️ {t("recommendation.weatherDisagreeNote")}</p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
              {result.cross_check_notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {result.why?.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-green-800">
            {result.why.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
