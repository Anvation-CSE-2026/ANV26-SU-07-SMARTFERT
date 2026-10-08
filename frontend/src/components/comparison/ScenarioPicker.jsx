import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Button } from "../common/Button";
import { useAppStore } from "../../store/useAppStore";

export function ScenarioPicker({ selected, onToggle }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scenarios = useAppStore((s) => s.scenarios);
  const renameScenario = useAppStore((s) => s.renameScenario);
  const deleteScenario = useAppStore((s) => s.deleteScenario);
  const setLastRecommendation = useAppStore((s) => s.setLastRecommendation);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  function startEdit(sc) {
    setEditingId(sc.id);
    setEditName(sc.name);
  }
  function commitEdit() {
    if (editName.trim()) renameScenario(editingId, editName.trim());
    setEditingId(null);
  }
  function loadIntoForm(sc) {
    setLastRecommendation(sc.input, sc.result);
    navigate("/input");
  }

  return (
    <Card>
      <CardHeader title={t("comparison.pickScenarios")} icon="📁" />
      <CardBody>
        <ul className="divide-y divide-green-50">
          {scenarios.map((sc) => {
            const checked = selected.includes(sc.id);
            return (
              <li key={sc.id} className="py-2.5 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(sc.id)}
                  disabled={!checked && selected.length >= 4}
                  className="w-5 h-5 accent-green-600 shrink-0"
                  aria-label={sc.name}
                />
                {editingId === sc.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                    className="flex-1 rounded-lg border border-green-300 px-2 py-1 text-sm"
                  />
                ) : (
                  <button onClick={() => startEdit(sc)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-green-900 truncate">{sc.name}</p>
                    <p className="text-xs text-green-700/60">{new Date(sc.createdAt).toLocaleDateString()}</p>
                  </button>
                )}
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => loadIntoForm(sc)} className="text-xs text-green-700 hover:underline px-1.5" title={t("comparison.loadBackIntoForm")}>
                    ↩️
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t("comparison.deleteConfirmBody"))) deleteScenario(sc.id);
                    }}
                    className="text-xs text-red-600 hover:underline px-1.5"
                    title={t("common.delete")}
                  >
                    🗑️
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {scenarios.length === 0 && <p className="text-sm text-green-700/60 py-3">{t("comparison.noScenarios")}</p>}
      </CardBody>
    </Card>
  );
}
