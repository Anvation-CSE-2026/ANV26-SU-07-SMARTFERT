import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Disclaimer } from "../components/common/Misc";
import { SummarySection } from "../components/recommendation/SummarySection";
import { ConfidenceSection } from "../components/recommendation/ConfidenceSection";
import { WhySection } from "../components/recommendation/WhySection";
import { WeatherReliabilityCard } from "../components/common/WeatherReliabilityCard";
import { PlanSection } from "../components/recommendation/PlanSection";
import { TimingSection } from "../components/recommendation/TimingSection";
import { YieldRiskSection } from "../components/recommendation/YieldRiskSection";
import { RotationSection } from "../components/recommendation/RotationSection";
import { SustainabilitySection } from "../components/recommendation/SustainabilitySection";
import { ConfidenceGaugeSection } from "../components/recommendation/ConfidenceGaugeSection";
import { AdaptiveLearningCard } from "../components/recommendation/AdaptiveLearningCard";
import { ActionsSection } from "../components/recommendation/ActionsSection";
import { useAppStore } from "../store/useAppStore";
import { ROTATION_TIPS } from "../data/staticData";

export default function Recommendation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lastInput = useAppStore((s) => s.lastInput);
  const lastResult = useAppStore((s) => s.lastResult);

  useEffect(() => {
    if (!lastResult) navigate("/input");
  }, [lastResult, navigate]);

  if (!lastResult) return null;

  const rotationTips = lastResult._rotation_tips || ROTATION_TIPS[lastInput?.crop] || ROTATION_TIPS.default;

  const readAloudText = [
    lastResult.message,
    lastResult.why?.join(". "),
    lastResult.advice?.join(". "),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <SummarySection input={lastInput} result={lastResult} />
      <ConfidenceSection confidenceMeta={lastResult.confidence_meta} />

      {!lastResult.no_deficiency && (
        <>
          <WhySection result={lastResult} />
          <WeatherReliabilityCard reliability={lastResult.weather_reliability} />
          <PlanSection result={lastResult} />
          <TimingSection result={lastResult} />
          <YieldRiskSection result={lastResult} />
          <RotationSection tips={rotationTips} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfidenceGaugeSection confidence={lastResult.confidence} />
            <SustainabilitySection sustainability={lastResult.sustainability} plan={lastResult.plan} alternatives={lastResult.alternatives} />
          </div>
          <AdaptiveLearningCard input={lastInput} result={lastResult} />
        </>
      )}

      <ActionsSection input={lastInput} result={lastResult} readAloudText={readAloudText} />

      <Disclaimer />

      <div className="no-print">
        <Button variant="ghost" onClick={() => navigate("/input")}>
          ← {t("common.back")}
        </Button>
      </div>
    </div>
  );
}
