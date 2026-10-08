import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { StepIndicator } from "../components/input/StepIndicator";
import { Field, NumberInput, SelectInput, TextInput } from "../components/input/Field";
import { PriorityMixer } from "../components/input/PriorityMixer";
import { SmartFarmerQuestions } from "../components/input/SmartFarmerQuestions";
import { WeatherReliabilityCard } from "../components/common/WeatherReliabilityCard";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import { getWeatherReliability } from "../api/mockEngine";
import { CROPS, CROP_NUTRIENT_NEED, DISTRICTS, TEXTURES } from "../data/staticData";
import { estimateSoilFromObservations } from "../utils/smartFarmerEstimate";

const SOIL_HELP = {
  N: "Typical range: 150-560 kg/ha",
  P: "Typical range: 5-30 kg/ha",
  K: "Typical range: 60-350 kg/ha",
};

export default function InputPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useAppStore((s) => s.location);
  const draftInput = useAppStore((s) => s.draftInput);
  const mixer = useAppStore((s) => s.mixer);
  const setLastRecommendation = useAppStore((s) => s.setLastRecommendation);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedNote, setParsedNote] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportFile, setReportFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [soilMode, setSoilMode] = useState("lab"); // "lab" | "farmer" (Smart Farmer Mode, no soil report)
  const [farmerObs, setFarmerObs] = useState({
    previousCrop: "",
    fieldSizeHa: "",
    irrigation: "",
    fertilizerHistory: "",
    previousYield: "",
    symptoms: [],
    drainage: "",
    freeText: "",
  });

  const [form, setForm] = useState(() => ({
    district: location?.district || "",
    lat: location?.lat ?? null,
    lon: location?.lon ?? null,
    crop: draftInput?.crop || "",
    target: "",
    N: "",
    P: "",
    K: "",
    pH: "",
    OC: "",
    texture: "",
    rain30: "",
    rain48: "",
    temp: "",
    dap_change: 0,
    urea_change: 0,
  }));

  const [weatherReliability, setWeatherReliability] = useState(null);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  // Auto-fill weather + soil estimate from /api/context once we know the district.
  useEffect(() => {
    if (!form.district) return;
    (async () => {
      const { data } = await api.getContext(form.lat, form.lon, form.district);
      setForm((f) => ({
        ...f,
        rain30: f.rain30 === "" ? data.weather.rain30 : f.rain30,
        rain48: f.rain48 === "" ? data.weather.rain48 : f.rain48,
        temp: f.temp === "" ? data.weather.temp : f.temp,
        pH: f.pH === "" ? data.soil_estimate.pH : f.pH,
        OC: f.OC === "" ? data.soil_estimate.OC : f.OC,
        texture: f.texture === "" ? data.soil_estimate.texture : f.texture,
      }));
    })();
    // Weather Prediction Reliability & Multi-Source Verification preview —
    // computed client-side (no network needed), purely additive to the
    // existing weather auto-fill above.
    setWeatherReliability(getWeatherReliability(form.district));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.district]);

  const cropNeed = CROP_NUTRIENT_NEED[form.crop];

  const steps = [
    { key: "location", label: t("input.stepLocation") },
    { key: "crop", label: t("input.stepCrop") },
    { key: "soil", label: t("input.stepSoil") },
    { key: "weather", label: t("input.stepWeather") },
    { key: "price", label: t("input.stepPrice") },
    { key: "mixer", label: t("input.stepMixer") },
  ];

  function validateStep(i) {
    const e = {};
    if (i === 0 && !form.district) e.district = t("input.requiredField");
    if (i === 1 && !form.crop) e.crop = t("input.requiredField");
    if (i === 2 && soilMode === "lab") {
      if (form.N === "" || form.N == null) e.N = t("input.requiredField");
      if (form.P === "" || form.P == null) e.P = t("input.requiredField");
      if (form.K === "" || form.K == null) e.K = t("input.requiredField");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }
  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleParseReport() {
    setParsing(true);
    const { data } = await api.postParseReport(reportText, reportFile);
    update({ N: data.parsed.N, P: data.parsed.P, K: data.parsed.K, pH: data.parsed.pH, OC: data.parsed.OC });
    setParsing(false);
    setParsedNote(true);
  }

  async function handleSubmit() {
    if (!validateStep(2)) {
      setStep(2);
      return;
    }
    setSubmitting(true);
    const objective = mixer.sustainability >= 55 ? "eco_inm" : mixer.cost >= 55 ? "cheapest" : "balanced_inm";

    let soilFields;
    let confidenceFields;
    if (soilMode === "farmer") {
      const estimate = estimateSoilFromObservations(farmerObs);
      soilFields = { N: estimate.N, P: estimate.P, K: estimate.K, pH: estimate.pH, OC: estimate.OC, texture: form.texture || undefined };
      confidenceFields = {
        input_mode: "farmer_observation",
        confidence: estimate.confidence,
        confidence_notes: estimate.confidenceNotes,
        missing_info_suggestions: estimate.missingInfoSuggestions,
      };
    } else {
      soilFields = {
        N: Number(form.N),
        P: Number(form.P),
        K: Number(form.K),
        pH: form.pH === "" ? undefined : Number(form.pH),
        OC: form.OC === "" ? undefined : Number(form.OC),
        texture: form.texture || undefined,
      };
      confidenceFields = { input_mode: "lab_report", confidence: "lab", confidence_notes: [], missing_info_suggestions: [] };
    }

    const payload = {
      crop: form.crop,
      ...soilFields,
      district: form.district,
      lat: form.lat,
      lon: form.lon,
      rain30: form.rain30 === "" ? undefined : Number(form.rain30),
      rain48: form.rain48 === "" ? undefined : Number(form.rain48),
      temp: form.temp === "" ? undefined : Number(form.temp),
      target: form.target === "" ? undefined : Number(form.target),
      objective,
      dap_change: Number(form.dap_change) || 0,
      urea_change: Number(form.urea_change) || 0,
      ...confidenceFields,
    };

    const { data } = await api.postRecommend(payload);
    setLastRecommendation(payload, data);
    setSubmitting(false);
    navigate("/recommendation");
  }

  const districtOptions = useMemo(() => DISTRICTS.map((d) => ({ value: d.name, label: `${d.name} (${d.state})` })), []);
  const cropOptions = useMemo(() => CROPS.map((c) => ({ value: c.id, label: t(`crops.${c.id}`) })), [t]);
  const textureOptions = useMemo(
    () => TEXTURES.map((tx) => ({ value: tx, label: t(`input.texture${tx[0].toUpperCase()}${tx.slice(1)}`) })),
    [t]
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-semibold text-green-900 mb-4">{t("input.title")}</h1>

      <StepIndicator steps={steps} current={step} onJump={setStep} />

      <Card className="mt-4">
        <CardBody>
          {step === 0 && (
            <div>
              <Field label={t("input.locationLabel")} required htmlFor="district">
                <SelectInput
                  id="district"
                  value={form.district}
                  onChange={(v) => {
                    const d = DISTRICTS.find((x) => x.name === v);
                    update({ district: v, lat: d?.lat ?? null, lon: d?.lon ?? null });
                  }}
                  options={districtOptions}
                  placeholder={t("common.selectPlaceholder")}
                />
              </Field>
              {errors.district && <p className="text-sm text-amber-700">{errors.district}</p>}
            </div>
          )}

          {step === 1 && (
            <div>
              <Field label={t("input.cropLabel")} required htmlFor="crop">
                <SelectInput id="crop" value={form.crop} onChange={(v) => update({ crop: v })} options={cropOptions} placeholder={t("common.selectPlaceholder")} />
              </Field>
              {draftInput?.crop && form.crop === draftInput.crop && (
                <Badge tone="mint" className="mb-3">
                  {t("input.cropPreselected")}
                </Badge>
              )}
              {errors.crop && <p className="text-sm text-amber-700 mb-2">{errors.crop}</p>}
              <Field
                label={t("input.targetYieldLabel")}
                helper={cropNeed ? `${t("input.targetYieldHelp")} (${t("common.typicalValue")}: ${cropNeed.typicalTarget} t/ha)` : t("input.targetYieldHelp")}
                htmlFor="target"
              >
                <NumberInput id="target" value={form.target} onChange={(v) => update({ target: v })} min={0} step={0.1} unit="t/ha" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex gap-2 mb-4" role="tablist" aria-label={t("smartFarmer.modeToggleLabel")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={soilMode === "lab"}
                  onClick={() => setSoilMode("lab")}
                  className={`flex-1 text-sm px-3 py-2.5 rounded-xl border font-medium ${soilMode === "lab" ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"}`}
                >
                  📄 {t("smartFarmer.modeLabReport")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={soilMode === "farmer"}
                  onClick={() => setSoilMode("farmer")}
                  className={`flex-1 text-sm px-3 py-2.5 rounded-xl border font-medium ${soilMode === "farmer" ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"}`}
                >
                  🌱 {t("smartFarmer.modeNoReport")}
                </button>
              </div>

              {soilMode === "farmer" ? (
                <SmartFarmerQuestions value={farmerObs} onChange={setFarmerObs} />
              ) : (
                <>
              <p className="text-sm text-green-700/70 mb-3">{t("input.soilSectionDesc")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3">
                <Field label={t("input.nitrogen")} required helper={SOIL_HELP.N} htmlFor="N">
                  <NumberInput id="N" value={form.N} onChange={(v) => update({ N: v })} min={0} unit="kg/ha" />
                </Field>
                <Field label={t("input.phosphorus")} required helper={SOIL_HELP.P} htmlFor="P">
                  <NumberInput id="P" value={form.P} onChange={(v) => update({ P: v })} min={0} unit="kg/ha" />
                </Field>
                <Field label={t("input.potassium")} required helper={SOIL_HELP.K} htmlFor="K">
                  <NumberInput id="K" value={form.K} onChange={(v) => update({ K: v })} min={0} unit="kg/ha" />
                </Field>
              </div>
              {(errors.N || errors.P || errors.K) && <p className="text-sm text-amber-700 mb-2">{t("input.requiredField")}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                <Field label={t("input.soilPh")} htmlFor="pH">
                  <NumberInput id="pH" value={form.pH} onChange={(v) => update({ pH: v })} min={3} max={10} step={0.1} />
                </Field>
                <Field label={t("input.organicCarbon")} htmlFor="OC">
                  <NumberInput id="OC" value={form.OC} onChange={(v) => update({ OC: v })} min={0} max={5} step={0.05} unit="%" />
                </Field>
              </div>
              <Field label={t("input.soilTexture")} htmlFor="texture">
                <SelectInput id="texture" value={form.texture} onChange={(v) => update({ texture: v })} options={textureOptions} placeholder={t("common.selectPlaceholder")} />
              </Field>

              <div className="mt-5 pt-4 border-t border-green-100">
                <p className="text-sm font-medium text-green-900 mb-2">{t("input.uploadReport")}</p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-green-700 mb-3"
                />
                <p className="text-sm text-green-700/70 mb-1.5">{t("input.orPasteText")}</p>
                <TextInput value={reportText} onChange={setReportText} placeholder="N: 180  P: 12  K: 90  pH: 6.5  OC: 0.4" />
                <Button variant="secondary" size="sm" className="mt-2" onClick={handleParseReport} disabled={parsing || (!reportText && !reportFile)}>
                  {parsing ? t("input.parsing") : t("input.parseReport")}
                </Button>
                {parsedNote && <p className="text-sm text-amber-700 mt-2">⚠️ {t("input.pleaseCheckValues")}</p>}
              </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-green-700/70 mb-3">{t("input.weatherAutoFilled")}</p>
              <Field label={t("input.rain30Label")} htmlFor="rain30">
                <NumberInput id="rain30" value={form.rain30} onChange={(v) => update({ rain30: v })} min={0} unit="mm" />
              </Field>
              <Field label={t("input.rain48Label")} htmlFor="rain48">
                <NumberInput id="rain48" value={form.rain48} onChange={(v) => update({ rain48: v })} min={0} unit="mm" />
              </Field>
              <Field label={t("input.tempLabel")} htmlFor="temp">
                <NumberInput id="temp" value={form.temp} onChange={(v) => update({ temp: v })} min={-10} max={55} unit="°C" />
              </Field>

              {weatherReliability && (
                <div className="mt-5 pt-4 border-t border-green-100">
                  <WeatherReliabilityCard reliability={weatherReliability} />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-sm text-green-700/70 mb-3">{t("input.priceSectionDesc")}</p>
              <Field label={t("input.dapChange")} htmlFor="dap_change">
                <NumberInput id="dap_change" value={form.dap_change} onChange={(v) => update({ dap_change: v })} min={-50} max={50} unit="%" />
              </Field>
              <Field label={t("input.ureaChange")} htmlFor="urea_change">
                <NumberInput id="urea_change" value={form.urea_change} onChange={(v) => update({ urea_change: v })} min={-50} max={50} unit="%" />
              </Field>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-lg font-semibold text-green-900 mb-1">{t("input.mixerTitle")}</h2>
              <PriorityMixer />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between mt-5 gap-3">
        <Button variant="ghost" onClick={goBack} disabled={step === 0}>
          ← {t("common.back")}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={goNext}>{t("common.next")} →</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} size="lg">
            {submitting ? t("common.loading") : t("input.showRecommendation")}
          </Button>
        )}
      </div>
    </div>
  );
}
