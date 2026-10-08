import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";

export function TimingSection({ result }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader title={t("recommendation.timingTitle")} icon="⏰" />
      <CardBody>
        {result.defer_application && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3 text-sm text-amber-800">
            🌧️ {t("recommendation.deferApplicationNote")}
          </div>
        )}
        <ul className="space-y-2 text-sm text-green-800">
          {result.advice.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
