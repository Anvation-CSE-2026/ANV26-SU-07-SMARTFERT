import { useTranslation } from "react-i18next";
import { Card, CardBody } from "../common/Card";
import { Disclaimer } from "../common/Misc";

export function SummarySection({ input, result }) {
  const { t } = useTranslation();

  if (result.no_deficiency) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardBody>
          <h1 className="text-xl sm:text-2xl font-semibold text-green-900 mb-1">🌿 {t("recommendation.noDeficiencyTitle")}</h1>
          <p className="text-green-800 mb-3">{t("recommendation.noDeficiencyBody")}</p>
          <Disclaimer />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white border-none">
      <CardBody>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">{t("recommendation.summaryTitle")}</h1>
        <p className="text-green-50/90 text-sm mb-3">
          {t("recommendation.basedOn", { district: input.district })}
        </p>
        <div className="bg-white/10 rounded-xl px-3 py-2.5 text-sm">{result.message}</div>
      </CardBody>
    </Card>
  );
}
