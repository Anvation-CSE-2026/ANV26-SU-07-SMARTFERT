import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import kn from "./locales/kn.json";
import hi from "./locales/hi.json";
import ml from "./locales/ml.json";

// NOTE / TODO: machine-assisted translations for ta, te, kn, hi, ml below.
// These need a review pass by native speakers before this app goes to real farmers.
// Any key missing in a non-English file silently falls back to English (see fallbackLng).
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
];

// Maps an Indian state name (as returned by mock/real geo lookups) to a
// suggested default language and nearby alternatives the user may prefer.
export const STATE_LANGUAGE_SUGGESTIONS = {
  "Tamil Nadu": { default: "ta", alternatives: ["en"] },
  Puducherry: { default: "ta", alternatives: ["en"] },
  "Andhra Pradesh": { default: "te", alternatives: ["en"] },
  Telangana: { default: "te", alternatives: ["en"] },
  Karnataka: { default: "kn", alternatives: ["te", "en"] },
  Kerala: { default: "ml", alternatives: ["en"] },
  "Uttar Pradesh": { default: "hi", alternatives: ["en"] },
  "Madhya Pradesh": { default: "hi", alternatives: ["en"] },
  Rajasthan: { default: "hi", alternatives: ["en"] },
  Bihar: { default: "hi", alternatives: ["en"] },
  Delhi: { default: "hi", alternatives: ["en"] },
  Haryana: { default: "hi", alternatives: ["en"] },
  Punjab: { default: "hi", alternatives: ["en"] },
  Maharashtra: { default: "hi", alternatives: ["en"] },
  Gujarat: { default: "hi", alternatives: ["en"] },
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ta: { translation: ta },
    te: { translation: te },
    kn: { translation: kn },
    ml: { translation: ml },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
