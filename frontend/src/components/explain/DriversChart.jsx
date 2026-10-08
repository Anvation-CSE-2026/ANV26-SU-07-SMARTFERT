import { useTranslation } from "react-i18next";

export function DriversChart({ drivers }) {
  const { t } = useTranslation();
  const maxAbs = Math.max(...drivers.map((d) => Math.abs(d.impact_t_ha)), 0.1);

  return (
    <div className="space-y-2">
      {drivers.map((d, i) => {
        const raises = d.direction === "raises";
        const widthPct = (Math.abs(d.impact_t_ha) / maxAbs) * 100;
        return (
          <div key={i}>
            <div className="flex justify-between text-xs text-green-800 mb-0.5">
              <span>{d.feature}</span>
              <span className={raises ? "text-green-700" : "text-amber-700"}>
                {raises ? "+" : ""}
                {d.impact_t_ha} t/ha
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-green-50 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: raises ? "var(--color-green-500)" : "var(--color-amber-500)" }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 text-[11px] text-green-700/70 mt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {t("explain.factorsRaise")}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {t("explain.factorsLower")}
        </span>
      </div>
    </div>
  );
}
