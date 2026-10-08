import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody } from "../common/Card";
import { EmptyState } from "../common/Misc";
import { Button } from "../common/Button";
import { useAppStore } from "../../store/useAppStore";

export function SavedScenariosCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scenarios = useAppStore((s) => s.scenarios);
  const setLastRecommendation = useAppStore((s) => s.setLastRecommendation);

  function openScenario(sc) {
    setLastRecommendation(sc.input, sc.result);
    navigate("/recommendation");
  }

  return (
    <Card>
      <CardHeader title={t("dashboard.savedScenariosTitle")} icon="📁" />
      <CardBody>
        {scenarios.length === 0 ? (
          <EmptyState icon="📁" title={t("dashboard.noSavedScenarios")} />
        ) : (
          <ul className="space-y-2">
            {scenarios.slice(-4).reverse().map((sc) => (
              <li key={sc.id}>
                <button
                  onClick={() => openScenario(sc)}
                  className="w-full text-left rounded-xl border border-green-100 px-3 py-2.5 hover:bg-green-50 transition-colors"
                >
                  <p className="text-sm font-medium text-green-900 truncate">{sc.name}</p>
                  <p className="text-xs text-green-700/60">{new Date(sc.createdAt).toLocaleDateString()}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {scenarios.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("/compare")}>
            {t("dashboard.viewAll")} →
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
