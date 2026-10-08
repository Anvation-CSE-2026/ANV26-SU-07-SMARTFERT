import { create } from "zustand";
import { persist } from "zustand/middleware";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeMixer({ sustainability, cost, yieldW }) {
  const total = sustainability + cost + yieldW;
  if (total === 0) return { sustainability: 34, cost: 33, yieldW: 33 };
  const scale = 100 / total;
  return {
    sustainability: Math.round(sustainability * scale),
    cost: Math.round(cost * scale),
    yieldW: Math.round(100 - Math.round(sustainability * scale) - Math.round(cost * scale)),
  };
}

export const MIXER_PRESETS = {
  eco: { sustainability: 80, cost: 10, yieldW: 10 },
  balanced: { sustainability: 50, cost: 30, yieldW: 20 },
  budget: { sustainability: 20, cost: 60, yieldW: 20 },
};

export const useAppStore = create(
  persist(
    (set, get) => ({
      // --- Location ---
      location: null, // { district, state, lat, lon, source }
      setLocation: (location) => set({ location }),

      // --- Language ---
      language: "en",
      languageExplicitlyChosen: false,
      setLanguage: (language, explicit = true) =>
        set({ language, languageExplicitlyChosen: explicit || get().languageExplicitlyChosen }),

      // --- Priority mixer (sustainability / cost saving / yield), sums to 100 ---
      mixer: { sustainability: 50, cost: 30, yieldW: 20 },
      setMixer: (partial) => set({ mixer: normalizeMixer({ ...get().mixer, ...partial }) }),
      applyPreset: (presetKey) => set({ mixer: { ...MIXER_PRESETS[presetKey] } }),

      // --- Draft input carried from Dashboard -> Input page ---
      draftInput: null,
      setDraftInput: (draftInput) => set({ draftInput }),

      // --- Most recent recommendation result, used by Recommendation/Explain pages ---
      lastInput: null,
      lastResult: null,
      setLastRecommendation: (input, result) => set({ lastInput: input, lastResult: result }),

      // --- Saved scenarios (persisted to localStorage) ---
      scenarios: [],
      saveScenario: (name, input, result) => {
        const scenario = { id: uid(), name, createdAt: Date.now(), input, result };
        set({ scenarios: [...get().scenarios, scenario] });
        return scenario;
      },
      renameScenario: (id, name) =>
        set({ scenarios: get().scenarios.map((s) => (s.id === id ? { ...s, name } : s)) }),
      deleteScenario: (id) => set({ scenarios: get().scenarios.filter((s) => s.id !== id) }),
      getScenario: (id) => get().scenarios.find((s) => s.id === id),
    }),
    {
      name: "fya-app-store",
      partialize: (state) => ({
        location: state.location,
        language: state.language,
        languageExplicitlyChosen: state.languageExplicitlyChosen,
        scenarios: state.scenarios,
        mixer: state.mixer,
      }),
    }
  )
);
