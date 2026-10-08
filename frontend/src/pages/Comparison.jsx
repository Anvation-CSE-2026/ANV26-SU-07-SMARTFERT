import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScenarioPicker } from "../components/comparison/ScenarioPicker";
import { ComparisonTable } from "../components/comparison/ComparisonTable";
import { ComparisonCharts } from "../components/comparison/ComparisonCharts";
import { WhyDifferentCard } from "../components/comparison/WhyDifferentCard";
import { EmptyState } from "../components/common/Misc";
import { useAppStore } from "../store/useAppStore";

export default function Comparison() {
  const { t } = useTranslation();
  const scenarios = useAppStore((s) => s.scenarios);
  const [selected, setSelected] = useState([]);

  function toggle(id) {
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < 4 ? [...sel, id] : sel));
  }

  const chosen = scenarios.filter((s) => selected.includes(s.id));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-xl sm:text-2xl font-semibold text-green-900">{t("comparison.title")}</h1>

      <ScenarioPicker selected={selected} onToggle={toggle} />

      {chosen.length >= 2 ? (
        <>
          <ComparisonTable scenarios={chosen} />
          <ComparisonCharts scenarios={chosen} />
          <WhyDifferentCard scenarios={chosen} />
        </>
      ) : (
        <EmptyState icon="📊" title={t("comparison.noScenarios")} />
      )}
    </div>
  );
}
