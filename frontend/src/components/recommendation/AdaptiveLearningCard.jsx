import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";
import { api } from "../../api/client";
import { useAppStore } from "../../store/useAppStore";

export function AdaptiveLearningCard({ input, result }) {
  const { t } = useTranslation();
  const setLastRecommendation = useAppStore((s) => s.setLastRecommendation);
  const [ignored, setIgnored] = useState(false);
  const [busy, setBusy] = useState(false);

  const adaptive = result?.adaptive;
  if (!adaptive?.available) return null;

  async function toggleIgnore() {
    const next = !ignored;
    setBusy(true);
    const { data } = await api.postRecommend({ ...input, ignore_adaptive: next });
    setBusy(false);
    setIgnored(next);
    setLastRecommendation(input, { ...data, recommendation_id: result.recommendation_id });
  }

  const mult = adaptive.dose_multiplier || {};
  const hasDoseChange = Object.values(mult).some((m) => Math.abs(m - 1) > 0.005);

  return (
    <Card className={adaptive.simulated ? "border-amber-200" : ""}>
      <CardHeader
        title={t("adaptive.title")}
        icon="🌱"
        action={adaptive.simulated ? <Badge tone="amber">{t("season.demoBadge")}</Badge> : null}
      />
      <CardBody>
        <p className="text-sm text-green-800 mb-3">{adaptive.message}</p>

        {hasDoseChange && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {["N", "P", "K"].map((n) => (
              <div key={n} className="bg-mint-50 rounded-lg p-2 text-center">
                <p className="text-[11px] text-green-700/60">{n}</p>
                <p className="text-sm font-semibold text-green-900">
                  {mult[n] >= 1 ? "+" : ""}
                  {Math.round((mult[n] - 1) * 100)}%
                </p>
              </div>
            ))}
          </div>
        )}

        {adaptive.yield_bias_pct ? (
          <p className="text-xs text-green-700/70 mb-3">
            {t("adaptive.yieldBias", { pct: adaptive.yield_bias_pct > 0 ? `+${adaptive.yield_bias_pct}` : adaptive.yield_bias_pct })}
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-green-800 cursor-pointer">
          <input type="checkbox" checked={ignored} onChange={toggleIgnore} disabled={busy} className="w-4 h-4 accent-green-600" />
          {busy ? t("common.loading") : t("adaptive.ignoreToggle")}
        </label>
      </CardBody>
    </Card>
  );
}
