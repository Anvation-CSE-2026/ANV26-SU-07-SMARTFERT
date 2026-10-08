// Smart Farmer Mode: turns a handful of farmer-friendly observations (no lab
// soil report) into a *preliminary* N/P/K/pH/OC estimate the rest of the app
// can treat like a soil report. This can never substitute for an actual lab
// test — it is explicitly labelled lower-confidence, and the dose logic in
// mockEngine.js already backs off further when confidence comes out "low".
import { SOIL_BANDS } from "../api/mockEngine";

const LEVEL = { low: 0, medium: 1, high: 2 };
const LEVEL_NAME = ["low", "medium", "high"];

// Representative kg/ha value for a rating band, used only so the estimate can
// flow through the same numeric soil_rating logic a lab report would.
function representativeValue(nutrient, levelIndex) {
  const band = SOIL_BANDS[nutrient];
  if (levelIndex <= 0) return Math.round(band.lowMax * 0.6);
  if (levelIndex === 1) return Math.round((band.lowMax + band.medMax) / 2);
  return Math.round(band.medMax * 1.3);
}

function clampLevel(n) {
  return Math.min(2, Math.max(0, n));
}

// Each observation group contributes zero or more signed "votes" per
// nutrient: negative = suspect deficiency, positive = suspect sufficiency.
function collectSignals(obs) {
  const signals = { N: [], P: [], K: [] };
  const vote = (nut, delta, source) => signals[nut].push({ delta, source });

  if (obs.fertilizerHistory === "none") {
    vote("N", -1, "fertilizerHistory");
    vote("K", -1, "fertilizerHistory");
  } else if (obs.fertilizerHistory === "organic") {
    vote("N", 0, "fertilizerHistory");
  } else if (obs.fertilizerHistory === "chemical" || obs.fertilizerHistory === "both") {
    vote("N", 1, "fertilizerHistory");
  }

  if (obs.previousYield === "poor") {
    vote("N", -1, "previousYield");
    vote("P", -1, "previousYield");
  } else if (obs.previousYield === "good") {
    vote("N", 1, "previousYield");
    vote("P", 1, "previousYield");
    vote("K", 1, "previousYield");
  }

  const symptoms = obs.symptoms || [];
  if (symptoms.includes("yellowing")) vote("N", -1, "symptom:yellowing");
  if (symptoms.includes("stunted")) {
    vote("N", -1, "symptom:stunted");
    vote("P", -1, "symptom:stunted");
  }
  if (symptoms.includes("poor_flowering")) {
    vote("P", -1, "symptom:poor_flowering");
    vote("K", -1, "symptom:poor_flowering");
  }
  if (symptoms.includes("purplish")) vote("P", -1, "symptom:purplish");
  if (symptoms.includes("scorch")) vote("K", -1, "symptom:scorch");

  if (obs.drainage === "waterlogged") vote("K", -1, "drainage");

  return signals;
}

// Very small free-text keyword assist — intentionally shallow. It only adds
// a corroborating signal when a keyword clearly matches a symptom already
// covered above; it never introduces a brand-new nutrient concern on its own.
function freeTextKeywordBoost(freeText, signals) {
  const txt = (freeText || "").toLowerCase();
  if (!txt) return;
  if (/yellow/.test(txt)) signals.N.push({ delta: -1, source: "freeText" });
  if (/stunt|slow grow|not growing/.test(txt)) signals.N.push({ delta: -1, source: "freeText" });
  if (/purple|reddish/.test(txt)) signals.P.push({ delta: -1, source: "freeText" });
  if (/scorch|burn.*edge|brown.*edge/.test(txt)) signals.K.push({ delta: -1, source: "freeText" });
  if (/water.?log|flood/.test(txt)) signals.K.push({ delta: -1, source: "freeText" });
}

export function estimateSoilFromObservations(obs) {
  const signals = collectSignals(obs);
  freeTextKeywordBoost(obs.freeText, signals);

  const levels = {};
  const confidenceNotes = [];
  const conflictedNutrients = [];
  let corroboratedCount = 0;
  let totalSignalGroups = 0;

  for (const nut of ["N", "P", "K"]) {
    const votes = signals[nut].filter((v) => v.delta !== 0);
    totalSignalGroups += votes.length > 0 ? 1 : 0;
    const sum = votes.reduce((s, v) => s + v.delta, 0);
    const distinctSources = new Set(votes.map((v) => v.source)).size;
    const allSameSign = votes.length > 0 && votes.every((v) => Math.sign(v.delta) === Math.sign(votes[0].delta));

    let levelIndex = LEVEL.medium;
    if (votes.length === 0) {
      // No signal either way — stay at the neutral medium band.
      levelIndex = LEVEL.medium;
    } else if (allSameSign) {
      levelIndex = clampLevel(LEVEL.medium + Math.sign(sum));
      if (distinctSources >= 2) corroboratedCount += 1;
    } else {
      // Conflicting signals for this nutrient — don't swing the estimate,
      // but flag it so we can lower overall confidence and explain why.
      conflictedNutrients.push(nut);
      levelIndex = LEVEL.medium;
    }
    levels[nut] = levelIndex;
  }

  if (conflictedNutrients.length) {
    confidenceNotes.push(
      `Your answers gave mixed signals for ${conflictedNutrients.join(" and ")}, so we kept that estimate neutral rather than guessing.`
    );
  }

  const confidence = conflictedNutrients.length > 0 || corroboratedCount === 0 ? "low" : "moderate";

  const missingInfoSuggestions = [];
  if (confidence === "low") {
    missingInfoSuggestions.push("A soil lab test would give an exact N, P and K reading instead of an estimate.");
  }
  if (!obs.symptoms?.length || obs.symptoms.includes("none")) {
    missingInfoSuggestions.push("Noting any visible symptoms (leaf colour, growth, flowering) would sharpen this estimate.");
  }
  if (obs.fertilizerHistory === undefined || obs.fertilizerHistory === null || obs.fertilizerHistory === "") {
    missingInfoSuggestions.push("Knowing what you applied last season would help estimate nitrogen and potassium more accurately.");
  }

  // Drainage/organic-history influenced pH & organic-carbon estimate.
  let pH = 6.5;
  let OC = 0.5;
  if (obs.drainage === "waterlogged") {
    pH -= 0.4;
    OC -= 0.1;
  } else if (obs.drainage === "well") {
    pH += 0.2;
  }
  if (obs.fertilizerHistory === "organic" || obs.fertilizerHistory === "both") OC += 0.15;
  if (obs.fertilizerHistory === "none") OC -= 0.1;
  pH = Math.round(Math.max(4.5, Math.min(8.5, pH)) * 10) / 10;
  OC = Math.round(Math.max(0.1, Math.min(1.2, OC)) * 100) / 100;

  return {
    N: representativeValue("N", levels.N),
    P: representativeValue("P", levels.P),
    K: representativeValue("K", levels.K),
    pH,
    OC,
    levels: { N: LEVEL_NAME[levels.N], P: LEVEL_NAME[levels.P], K: LEVEL_NAME[levels.K] },
    confidence,
    confidenceNotes,
    missingInfoSuggestions,
  };
}
