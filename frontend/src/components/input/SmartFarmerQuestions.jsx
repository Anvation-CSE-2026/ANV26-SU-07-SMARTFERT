import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, SelectInput, NumberInput, TextInput } from "./Field";
import { Badge } from "../common/Badge";
import {
  CROPS,
  IRRIGATION_LEVELS,
  FERTILIZER_HISTORY_OPTIONS,
  YIELD_PERFORMANCE_OPTIONS,
  SYMPTOM_OPTIONS,
  DRAINAGE_OPTIONS,
} from "../../data/staticData";

function toggleInArray(arr, value) {
  if (value === "none") return arr.includes("none") ? [] : ["none"];
  const withoutNone = arr.filter((v) => v !== "none");
  return withoutNone.includes(value) ? withoutNone.filter((v) => v !== value) : [...withoutNone, value];
}

export function SmartFarmerQuestions({ value, onChange }) {
  const { t, i18n } = useTranslation();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  function update(patch) {
    onChange({ ...value, ...patch });
  }

  const speechSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  function toggleVoiceInput() {
    if (!speechSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = i18n.language === "en" ? "en-IN" : i18n.language;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      update({ freeText: value.freeText ? `${value.freeText} ${transcript}` : transcript });
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  const cropOptions = [{ value: "", label: t("common.selectPlaceholder") }, ...CROPS.map((c) => ({ value: c.id, label: t(`crops.${c.id}`) }))];
  const irrigationOptions = IRRIGATION_LEVELS.map((v) => ({ value: v, label: t(`smartFarmer.irrigation${v[0].toUpperCase()}${v.slice(1)}`) }));
  const fertHistoryOptions = FERTILIZER_HISTORY_OPTIONS.map((v) => ({ value: v, label: t(`smartFarmer.fert${v[0].toUpperCase()}${v.slice(1)}`) }));
  const yieldOptions = YIELD_PERFORMANCE_OPTIONS.map((v) => ({ value: v, label: t(`smartFarmer.yield${v[0].toUpperCase()}${v.slice(1)}`) }));
  const drainageOptions = DRAINAGE_OPTIONS.map((v) => ({ value: v, label: t(`smartFarmer.drainage${v[0].toUpperCase()}${v.slice(1)}`) }));

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-sm text-amber-800">
        📋 {t("smartFarmer.disclaimer")}
      </div>

      <Field label={t("smartFarmer.previousCrop")} htmlFor="prevCrop">
        <SelectInput id="prevCrop" value={value.previousCrop} onChange={(v) => update({ previousCrop: v })} options={cropOptions.slice(1)} placeholder={t("common.selectPlaceholder")} />
      </Field>

      <Field label={t("smartFarmer.fieldSize")} htmlFor="fieldSize">
        <NumberInput id="fieldSize" value={value.fieldSizeHa} onChange={(v) => update({ fieldSizeHa: v })} min={0} step={0.1} unit="ha" />
      </Field>

      <Field label={t("smartFarmer.irrigation")} htmlFor="irrigation">
        <SelectInput id="irrigation" value={value.irrigation} onChange={(v) => update({ irrigation: v })} options={irrigationOptions} placeholder={t("common.selectPlaceholder")} />
      </Field>

      <Field label={t("smartFarmer.fertilizerHistory")} htmlFor="fertHistory">
        <SelectInput id="fertHistory" value={value.fertilizerHistory} onChange={(v) => update({ fertilizerHistory: v })} options={fertHistoryOptions} placeholder={t("common.selectPlaceholder")} />
      </Field>

      <Field label={t("smartFarmer.previousYield")} htmlFor="prevYield">
        <SelectInput id="prevYield" value={value.previousYield} onChange={(v) => update({ previousYield: v })} options={yieldOptions} placeholder={t("common.selectPlaceholder")} />
      </Field>

      <Field label={t("smartFarmer.symptoms")}>
        <div className="flex flex-wrap gap-2">
          {SYMPTOM_OPTIONS.map((s) => {
            const active = (value.symptoms || []).includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => update({ symptoms: toggleInArray(value.symptoms || [], s) })}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  active ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"
                }`}
                aria-pressed={active}
              >
                {t(`smartFarmer.symptom${s[0].toUpperCase()}${s.slice(1)}`)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t("smartFarmer.drainage")} htmlFor="drainage">
        <SelectInput id="drainage" value={value.drainage} onChange={(v) => update({ drainage: v })} options={drainageOptions} placeholder={t("common.selectPlaceholder")} />
      </Field>

      <Field label={t("smartFarmer.freeText")} htmlFor="freeText">
        <div className="flex gap-2">
          <div className="flex-1">
            <TextInput id="freeText" value={value.freeText} onChange={(v) => update({ freeText: v })} placeholder={t("smartFarmer.freeTextPlaceholder")} />
          </div>
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-pressed={listening}
              className={`shrink-0 rounded-xl border px-3 text-lg ${listening ? "bg-red-50 border-red-300 text-red-600" : "bg-white border-green-200 text-green-700"}`}
              title={t("smartFarmer.voiceInput")}
            >
              🎤
            </button>
          )}
        </div>
        {listening && <Badge tone="amber" className="mt-2">🎤 {t("smartFarmer.listening")}</Badge>}
        {!speechSupported && <p className="text-xs text-green-700/50 mt-1">{t("smartFarmer.voiceNotSupported")}</p>}
      </Field>
    </div>
  );
}
