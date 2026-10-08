import { useTranslation } from "react-i18next";
import { Card, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";

export function ConfidenceSection({ confidenceMeta }) {
  const { t } = useTranslation();
  if (!confidenceMeta) return null;
  const { input_mode, confidence, confidence_notes = [], missing_info_suggestions = [] } = confidenceMeta;

  const isLab = input_mode === "lab_report";
  const tone = isLab ? "green" : confidence === "low" ? "amber" : "mint";
  const title = isLab
    ? t("smartFarmer.confidenceLab")
    : confidence === "low"
    ? t("smartFarmer.confidenceLow")
    : t("smartFarmer.confidenceModerate");
  const desc = isLab ? t("smartFarmer.confidenceLabDesc") : t("smartFarmer.confidenceFarmerDesc");

  return (
    <Card className={isLab ? "" : "border-amber-200"}>
      <CardBody className="flex items-start gap-3">
        <span className="text-2xl shrink-0" aria-hidden="true">
          {isLab ? "✅" : "📋"}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={tone}>{title}</Badge>
          </div>
          <p className="text-sm text-green-800 mt-1.5">{desc}</p>

          {!isLab && confidence === "low" && (
            <p className="text-sm text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ {t("smartFarmer.conservativeNote")}
            </p>
          )}

          {confidence_notes.length > 0 && (
            <ul className="text-xs text-green-700/80 mt-2 space-y-0.5 list-disc list-inside">
              {confidence_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          {missing_info_suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-green-800">{t("smartFarmer.improveConfidence")}</p>
              <ul className="text-xs text-green-700/80 mt-0.5 space-y-0.5 list-disc list-inside">
                {missing_info_suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
