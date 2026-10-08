import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Button } from "../common/Button";
import { useAppStore } from "../../store/useAppStore";

export function ActionsSection({ input, result, readAloudText }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const saveScenario = useAppStore((s) => s.saveScenario);
  const scenarios = useAppStore((s) => s.scenarios);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState(null);
  const [speaking, setSpeaking] = useState(false);

  function nextScenarioLetter() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const l of letters) {
      if (!scenarios.some((s) => s.name === `Scenario ${l}`)) return l;
    }
    return letters[scenarios.length % letters.length];
  }

  function handleSave() {
    setSaving(true);
    const letter = nextScenarioLetter();
    const name = `Scenario ${letter} — ${t(`crops.${input.crop}`)}`;
    saveScenario(name, input, result);
    setSavedName(name);
    setSaving(false);
  }

  function toggleReadAloud() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new window.SpeechSynthesisUtterance(readAloudText);
    utter.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  return (
    <Card className="no-print">
      <CardHeader title={t("recommendation.actionsTitle")} icon="⚡" />
      <CardBody className="flex flex-wrap gap-2.5">
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          💾 {t("recommendation.saveScenario")}
        </Button>
        <Button variant="secondary" onClick={() => navigate("/compare")}>
          📊 {t("common.compare")}
        </Button>
        <Button variant="secondary" onClick={() => navigate("/explain")}>
          🧭 {t("common.explain")}
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          🖨️ {t("common.print")}
        </Button>
        {"speechSynthesis" in window && (
          <Button variant="ghost" onClick={toggleReadAloud}>
            🔊 {speaking ? t("common.stopReading") : t("common.readAloud")}
          </Button>
        )}
        {savedName && <p className="text-sm text-green-700 w-full">✅ {t("recommendation.savedAs")}: {savedName}</p>}
      </CardBody>
    </Card>
  );
}
