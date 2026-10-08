import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { CardSkeleton } from "../common/Skeleton";
import { Sparkline, TrendArrow } from "../common/Misc";
import { api } from "../../api/client";
import { SUSTAINABLE_FERTILIZERS, CONVENTIONAL_FERTILIZERS } from "../../data/staticData";

function PriceRow({ fert, trend }) {
  const { t } = useTranslation();
  if (!trend) return null;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 border-b border-green-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-green-900 truncate">{fert.name}</p>
        <p className="text-xs text-green-700/60">
          ₹{trend.last_price} {t("common.perKg")}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Sparkline points={trend.sparkline} />
        <span className="text-xs font-medium flex items-center gap-1">
          <TrendArrow direction={trend.direction} />
          {trend.change_pct > 0 ? "+" : ""}
          {trend.change_pct}%
        </span>
      </div>
    </li>
  );
}

export function PriceList() {
  const { t } = useTranslation();
  const [trends, setTrends] = useState({});
  const [loading, setLoading] = useState(true);
  const [showConventional, setShowConventional] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const ids = [...SUSTAINABLE_FERTILIZERS, ...CONVENTIONAL_FERTILIZERS].map((f) => f.id);
      const results = await Promise.all(ids.map((id) => api.getPriceTrend(id)));
      if (!active) return;
      const map = {};
      ids.forEach((id, i) => (map[id] = results[i].data));
      setTrends(map);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <CardSkeleton lines={5} />;

  return (
    <Card>
      <CardHeader title={t("dashboard.pricesTitle")} subtitle={t("dashboard.pricesDesc")} icon="💰" />
      <CardBody>
        <ul>
          {SUSTAINABLE_FERTILIZERS.map((f) => (
            <PriceRow key={f.id} fert={f} trend={trends[f.id]} />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowConventional((s) => !s)}
          className="mt-3 text-sm font-medium text-green-700 hover:text-green-800 flex items-center gap-1"
          aria-expanded={showConventional}
        >
          <span className={`transition-transform ${showConventional ? "rotate-90" : ""}`}>▸</span>
          {t("dashboard.conventionalSection")}
        </button>
        {showConventional && (
          <ul className="mt-2 bg-mint-50 rounded-xl px-3">
            {CONVENTIONAL_FERTILIZERS.map((f) => (
              <PriceRow key={f.id} fert={f} trend={trends[f.id]} />
            ))}
          </ul>
        )}
        <p className="text-xs text-green-700/60 mt-3">
          {t("common.typicalValue")} · {t("dashboard.last3Months")}
        </p>
      </CardBody>
    </Card>
  );
}
