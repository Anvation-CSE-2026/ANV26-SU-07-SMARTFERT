import { useTranslation } from "react-i18next";
import { useAppStore, MIXER_PRESETS } from "../../store/useAppStore";
import { mixerSentenceKey } from "../../utils/scoring";

const ROWS = [
  { key: "sustainability", color: "var(--color-green-600)", labelKey: "input.sustainability" },
  { key: "cost", color: "var(--color-amber-500)", labelKey: "input.costSaving" },
  { key: "yieldW", color: "#3b82f6", labelKey: "input.yield" },
];

export function PriorityMixer() {
  const { t } = useTranslation();
  const mixer = useAppStore((s) => s.mixer);
  const setMixer = useAppStore((s) => s.setMixer);
  const applyPreset = useAppStore((s) => s.applyPreset);

  return (
    <div>
      <p className="text-sm text-green-700/70 mb-4">{t("input.mixerDesc")}</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {Object.keys(MIXER_PRESETS).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className="text-sm px-3 py-1.5 rounded-full border border-green-200 bg-white text-green-700 hover:bg-green-50"
          >
            {t(`input.preset${key[0].toUpperCase()}${key.slice(1)}`)}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {ROWS.map((row) => (
          <div key={row.key}>
            <div className="flex justify-between text-sm mb-1.5">
              <label htmlFor={`mixer-${row.key}`} className="font-medium text-green-900">
                {t(row.labelKey)}
              </label>
              <span className="font-semibold" style={{ color: row.color }}>
                {mixer[row.key]}%
              </span>
            </div>
            <input
              id={`mixer-${row.key}`}
              type="range"
              min={0}
              max={100}
              value={mixer[row.key]}
              onChange={(e) => setMixer({ [row.key]: Number(e.target.value) })}
              className="w-full h-3 rounded-full appearance-none cursor-pointer accent-green-600"
              style={{ accentColor: row.color }}
              aria-valuetext={`${mixer[row.key]}%`}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 bg-mint-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-800">
        💬 {t(`input.${mixerSentenceKey(mixer)}`)}
      </div>
    </div>
  );
}
