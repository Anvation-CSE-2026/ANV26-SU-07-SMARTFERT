import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";

export function RotationSection({ tips }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader title={t("recommendation.nextRotationTitle")} icon="🔄" action={<Badge tone="mint">{t("recommendation.generalGuidanceLabel")}</Badge>} />
      <CardBody>
        <ul className="space-y-2.5 text-sm text-green-800">
          {tips.map((tip) => (
            <li key={tip.id} className="flex gap-2">
              <span aria-hidden="true">🌱</span>
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
