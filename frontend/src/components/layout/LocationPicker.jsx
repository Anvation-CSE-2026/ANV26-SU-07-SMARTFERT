import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { api } from "../../api/client";
import { useAppStore } from "../../store/useAppStore";
import { STATE_LANGUAGE_SUGGESTIONS } from "../../i18n";

export function LocationPicker({ open, onClose, districts = [] }) {
  const { t, i18n } = useTranslation();
  const setLocation = useAppStore((s) => s.setLocation);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const languageExplicit = useAppStore((s) => s.languageExplicitlyChosen);
  const [mode, setMode] = useState("choose"); // choose | typing | detecting | denied
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return districts.slice(0, 8);
    return districts.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);
  }, [districts, query]);

  function applyLocationAndLanguage(districtDetail, source) {
    setLocation({ district: districtDetail.name, state: districtDetail.state, lat: districtDetail.lat, lon: districtDetail.lon, source });
    if (!languageExplicit) {
      const suggestion = STATE_LANGUAGE_SUGGESTIONS[districtDetail.state];
      if (suggestion) {
        i18n.changeLanguage(suggestion.default);
        setLanguage(suggestion.default, false);
      }
    }
    onClose?.();
  }

  async function useMyLocation() {
    setMode("detecting");
    setError(null);
    if (!navigator.geolocation) {
      setError(t("location.permissionDenied"));
      setMode("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { data } = await api.getContext(latitude, longitude, null);
        applyLocationAndLanguage(
          { name: data.district, state: data.state, lat: data.lat ?? latitude, lon: data.lon ?? longitude },
          "geo"
        );
      },
      () => {
        setError(t("location.permissionDenied"));
        setMode("denied");
      },
      { timeout: 8000 }
    );
  }

  function pickDistrict(d) {
    applyLocationAndLanguage(d, "manual");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="loc-title">
      <Card className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <h2 id="loc-title" className="text-lg font-semibold text-green-900">
            {t("location.title")}
          </h2>

          {mode === "choose" && (
            <div className="mt-4 space-y-3">
              <Button fullWidth onClick={useMyLocation}>
                📍 {t("location.useMyLocation")}
              </Button>
              <Button fullWidth variant="secondary" onClick={() => setMode("typing")}>
                ⌨️ {t("location.typeDistrict")}
              </Button>
              <button type="button" onClick={onClose} className="w-full text-center text-sm text-green-700/70 py-2">
                {t("location.skip")}
              </button>
            </div>
          )}

          {mode === "detecting" && (
            <div className="mt-6 text-center text-green-700 py-6">
              <div className="skeleton h-10 w-10 rounded-full mx-auto mb-3" />
              {t("location.detecting")}
            </div>
          )}

          {(mode === "typing" || mode === "denied") && (
            <div className="mt-4">
              {error && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("location.searchPlaceholder")}
                className="w-full rounded-xl border border-green-200 px-4 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
              />
              <ul className="mt-2 divide-y divide-green-50 max-h-56 overflow-y-auto rounded-xl border border-green-100">
                {filtered.map((d) => (
                  <li key={d.name}>
                    <button
                      type="button"
                      onClick={() => pickDistrict(d)}
                      className="w-full text-left px-4 py-3 hover:bg-green-50 text-sm"
                    >
                      <span className="font-medium text-green-900">{d.name}</span>
                      <span className="text-green-700/60"> · {d.state}</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-4 py-3 text-sm text-green-700/60">No matches</li>}
              </ul>
              <button type="button" onClick={() => setMode("choose")} className="mt-3 text-sm text-green-700/70">
                ← {t("common.back")}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
