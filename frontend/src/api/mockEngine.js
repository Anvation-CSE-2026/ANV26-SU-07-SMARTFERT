// Mock-data engine: stands in for the Flask backend so the whole UI keeps
// working offline. Shapes every response to match the real /api contract
// documented in the project README.
import {
  DISTRICTS,
  CROPS,
  CROP_NUTRIENT_NEED,
  SUSTAINABLE_FERTILIZERS,
  CONVENTIONAL_FERTILIZERS,
  ALL_FERTILIZERS,
  TEXTURES,
  OBJECTIVES,
  ROTATION_TIPS,
} from "../data/staticData";

// --- small deterministic PRNG so the same district/crop gives stable demo
// numbers within a session, instead of jumping around on every re-render.
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFor(key) {
  return mulberry32(hashSeed(key));
}
function roundTo(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function findDistrict(name) {
  return DISTRICTS.find((d) => d.name.toLowerCase() === String(name).toLowerCase());
}

export function nearestDistrict(lat, lon) {
  let best = DISTRICTS[0];
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(d.lat - lat, d.lon - lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

export function getMeta() {
  return {
    crops: CROPS.map((c) => c.id),
    cropDetails: CROPS,
    districts: DISTRICTS.map((d) => d.name),
    districtDetails: DISTRICTS,
    fertilizers: ALL_FERTILIZERS.map((f) => f.id),
    textures: TEXTURES,
    objectives: OBJECTIVES,
  };
}

function weatherForDistrict(districtName) {
  const rng = rngFor(`weather:${districtName}`);
  const baseTemp = 24 + rng() * 10; // 24-34 C
  const rain30 = Math.round(20 + rng() * 180); // mm
  const rain48 = Math.round(rng() * 60);
  const rainSlope = roundTo((rng() - 0.55) * 6, 2); // mm/yr trend, slightly biased down
  const tempSlope = roundTo((rng() - 0.3) * 0.08, 3);
  const rainTrend = rainSlope > 0.5 ? "increasing" : rainSlope < -0.5 ? "decreasing" : "stable";
  const tempTrend = tempSlope > 0.01 ? "increasing" : tempSlope < -0.01 ? "decreasing" : "stable";
  return {
    temp: roundTo(baseTemp, 1),
    rain30,
    rain48,
    rainSlope,
    tempSlope,
    rainTrend,
    tempTrend,
    source: "Typical values (mock weather model)",
  };
}

// Weather Prediction Reliability & Multi-Source Verification.
// Stands in for pulling several real weather providers + a historical/local
// baseline and checking how well they agree, so a fertilizer recommendation
// never leans on a single, possibly-wrong weather forecast. This is a
// software-only demo signal (clearly labelled as such in the UI) — it does
// not claim to improve actual weather forecasting accuracy.
function perturbPct(rng, center, spread) {
  return Math.round(clamp(center + (rng() - 0.5) * 2 * spread, 0, 100));
}

export function getWeatherReliability(districtName) {
  const base = weatherForDistrict(districtName);
  const rngA = rngFor(`wxA:${districtName}`);
  const rngB = rngFor(`wxB:${districtName}`);
  const rngH = rngFor(`wxHist:${districtName}`);

  // A latent "true" rain-probability-ish proxy derived from the deterministic
  // 48h outlook, so every source perturbs around the same underlying signal
  // rather than being fully independent noise.
  const latentProb = clamp(Math.round((base.rain48 / 55) * 100), 4, 96);

  const sourceA = {
    name: "Source A",
    rain_probability_pct: perturbPct(rngA, latentProb, 27),
    rain_amount_mm: roundTo(base.rain48 * (0.75 + rngA() * 0.5), 1),
    temp_c: roundTo(base.temp + (rngA() - 0.5) * 2.4, 1),
    humidity_pct: Math.round(55 + rngA() * 35),
    extreme_alert: rngA() > 0.88,
  };
  const sourceB = {
    name: "Source B",
    rain_probability_pct: perturbPct(rngB, latentProb, 27),
    rain_amount_mm: roundTo(base.rain48 * (0.75 + rngB() * 0.5), 1),
    temp_c: roundTo(base.temp + (rngB() - 0.5) * 2.4, 1),
    humidity_pct: Math.round(55 + rngB() * 35),
    extreme_alert: rngB() > 0.88,
  };
  const historical = {
    name: "Historical pattern",
    rain_probability_pct: perturbPct(rngH, latentProb, 14),
    rain_amount_mm: roundTo(base.rain48 * (0.85 + rngH() * 0.3), 1),
    temp_c: roundTo(base.temp + (rngH() - 0.5) * 1.2, 1),
    humidity_pct: Math.round(55 + rngH() * 30),
    extreme_alert: false,
  };

  const sources = [sourceA, sourceB, historical];
  const probs = sources.map((s) => s.rain_probability_pct);
  const temps = sources.map((s) => s.temp_c);
  const probSpread = Math.max(...probs) - Math.min(...probs);
  const tempSpread = roundTo(Math.max(...temps) - Math.min(...temps), 1);
  const anyExtreme = sources.some((s) => s.extreme_alert);

  const blended = {
    rain_probability_pct: Math.round(probs.reduce((a, b) => a + b, 0) / probs.length),
    rain_amount_mm: roundTo(sources.reduce((a, s) => a + s.rain_amount_mm, 0) / sources.length, 1),
    temp_c: roundTo(temps.reduce((a, b) => a + b, 0) / temps.length, 1),
    humidity_pct: Math.round(sources.reduce((a, s) => a + s.humidity_pct, 0) / sources.length),
  };

  let score = 100 - probSpread * 1.35 - tempSpread * 4.5;
  if (anyExtreme) score -= 20;
  score = clamp(Math.round(score), 5, 98);
  const level = score >= 75 ? "high" : score >= 45 ? "moderate" : "low";

  const conflicts = [];
  if (probSpread > 15) {
    conflicts.push(
      `Rain-probability estimates ranged from ${Math.min(...probs)}% to ${Math.max(...probs)}% across sources — a ${probSpread}-point spread.`
    );
  }
  if (tempSpread > 3) {
    conflicts.push(`Temperature estimates varied by about ${tempSpread}°C across sources.`);
  }
  if (anyExtreme) {
    conflicts.push("At least one source flagged a possible extreme weather event in the next few days.");
  }

  const recommendationNote =
    level === "high"
      ? "Weather sources broadly agree — normal recommendation logic applies."
      : level === "moderate"
      ? "Sources disagree somewhat — we nudged the dose toward the safer end of the range as a caution."
      : "Sources disagree significantly — we leaned on a conservative, safer dose and would suggest watching the forecast before applying the full amount.";

  return {
    sources: [sourceA, sourceB],
    historical,
    blended,
    confidence: { score, level, prob_spread_pct: probSpread, temp_spread_c: tempSpread, conflicts },
    recommendation_note: recommendationNote,
  };
}

function soilEstimateForDistrict(districtName) {
  const rng = rngFor(`soil:${districtName}`);
  return {
    pH: roundTo(6.0 + rng() * 1.6, 1),
    OC: roundTo(0.3 + rng() * 0.6, 2),
    texture: TEXTURES[Math.floor(rng() * TEXTURES.length)],
  };
}

export function getContext({ lat, lon, district }) {
  const d = district ? findDistrict(district) : lat != null && lon != null ? nearestDistrict(lat, lon) : DISTRICTS[0];
  const weather = weatherForDistrict(d.name);
  const soil_estimate = soilEstimateForDistrict(d.name);
  return {
    district: d.name,
    state: d.state,
    lat: d.lat,
    lon: d.lon,
    weather: {
      rain30: weather.rain30,
      rain48: weather.rain48,
      temp: weather.temp,
      source: weather.source,
    },
    soil_estimate,
    trend: {
      rain_trend: weather.rainTrend,
      rain_sen_slope_mm_per_yr: weather.rainSlope,
      temp_trend: weather.tempTrend,
    },
  };
}

export function getPriceTrend(fertilizerId) {
  const fert = ALL_FERTILIZERS.find((f) => f.id === fertilizerId) || ALL_FERTILIZERS[0];
  const rng = rngFor(`price:${fert.id}`);
  const last_price = roundTo(fert.pricePerKg * (0.95 + rng() * 0.1), 2);
  const driftPct = (rng() - 0.45) * 0.16; // slight upward bias for chemical ferts
  const forecast = [1, 2, 3].map((m) => roundTo(last_price * (1 + driftPct * (m / 3)), 2));
  const change_pct = roundTo(driftPct * 100, 1);
  return {
    fertilizer: fert.id,
    name: fert.name,
    last_price,
    forecast,
    change_pct,
    direction: change_pct > 1 ? "up" : change_pct < -1 ? "down" : "flat",
    sparkline: [last_price * 0.97, last_price * 0.99, last_price, ...forecast],
  };
}

export function getClimateTrend(districtName) {
  const weather = weatherForDistrict(districtName);
  return {
    district: districtName,
    rain_trend: weather.rainTrend,
    rain_sen_slope_mm_per_yr: weather.rainSlope,
    temp_trend: weather.tempTrend,
  };
}

export function getModelInfo() {
  return {
    model: "Mock gradient-boosted estimator (demo)",
    trained_on: "Partly synthetic / simulated agronomic data",
    confidence_note:
      "This is a simplified demo model. Treat every number as a helpful estimate, not a lab-verified result.",
    interval: "80%",
    version: "mock-0.1",
  };
}

export function getScenarios() {
  return [
    { id: "demo_rice_tn", label: "Rice in Thanjavur (sample)", crop: "rice", district: "Thanjavur", N: 180, P: 12, K: 90 },
    { id: "demo_cotton_tg", label: "Cotton in Warangal (sample)", crop: "cotton", district: "Warangal", N: 90, P: 8, K: 60 },
    { id: "demo_wheat_up", label: "Wheat in Meerut (sample)", crop: "wheat", district: "Meerut", N: 150, P: 10, K: 70 },
  ];
}

function ratingFor(value, lowMax, medMax) {
  if (value < lowMax) return "low";
  if (value < medMax) return "medium";
  return "high";
}

// Standard-ish Indian soil test classification bands, kg/ha.
export const SOIL_BANDS = {
  N: { lowMax: 280, medMax: 560 },
  P: { lowMax: 10, medMax: 24 },
  K: { lowMax: 108, medMax: 280 },
};

// Mirrors the backend's confidence.py weighting (same weights/bands) so the
// demo looks consistent whether the UI is talking to the real API or running
// entirely offline on mock data. A HEURISTIC indicator, not a statistical
// probability - see confidence.note below.
const CONFIDENCE_WEIGHTS = {
  data_quality: 0.3,
  model_agreement: 0.2,
  interval_tightness: 0.2,
  in_distribution: 0.15,
  feedback_support: 0.1,
  satellite_agreement: 0.05,
};
const PLAUSIBLE_RANGE = { N: [50, 700], P: [2, 60], K: [20, 500], pH: [4.5, 9], OC: [0.1, 2] };

function estimateConfidenceScore({ inputMode, smartFarmerConfidence, soilRating, earlyWarningPrior, pointTHa, yieldSpread, N, P, K, pH, OC }) {
  const npkQuality = inputMode === "farmer_observation" ? (smartFarmerConfidence === "low" ? 0.5 : 0.75) : 1.0;
  const data_quality = clamp((npkQuality + 1.0 + 1.0) / 3, 0, 1);

  const disagreements = ["N", "P", "K"].filter((n) => earlyWarningPrior[n] !== soilRating[n]).length;
  const model_agreement = clamp(1 - disagreements / 3, 0, 1);

  const interval_tightness = pointTHa > 0 ? clamp(1 - yieldSpread / pointTHa, 0, 1) : null;

  const checks = [["N", N], ["P", P], ["K", K], ["pH", pH], ["OC", OC]].filter(([, v]) => v != null);
  const inside = checks.filter(([k, v]) => v >= PLAUSIBLE_RANGE[k][0] && v <= PLAUSIBLE_RANGE[k][1]).length;
  const in_distribution = checks.length ? inside / checks.length : null;

  const components = { data_quality, model_agreement, interval_tightness, in_distribution, feedback_support: null, satellite_agreement: null };
  const available = Object.entries(components).filter(([, v]) => v != null);
  const totalWeight = available.reduce((s, [k]) => s + CONFIDENCE_WEIGHTS[k], 0) || 1;
  const score = clamp(
    Math.round((100 * available.reduce((s, [k, v]) => s + CONFIDENCE_WEIGHTS[k] * v, 0)) / totalWeight),
    0,
    100
  );
  const band = score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";

  const reasons = [];
  const how_to_improve = [];
  if (data_quality >= 0.9) reasons.push("Your N, P and K came from your own soil report.");
  else how_to_improve.push("A lab soil report (instead of Smart Farmer Mode) would sharpen this estimate.");
  if (model_agreement < 0.6) reasons.push("Weather-based early signals did not fully agree with your soil report.");
  if (interval_tightness != null && interval_tightness < 0.5) how_to_improve.push("A fresh soil test can narrow the yield estimate's range.");
  if (in_distribution != null && in_distribution < 0.8) {
    reasons.push("A few of your values are outside the typical range, so treat this estimate with extra care.");
    how_to_improve.push("A soil lab test would help confirm whether these unusual readings are accurate.");
  }
  how_to_improve.push("Once more farmers nearby share what happened after applying, this estimate can be fine-tuned for your area.");

  return {
    score,
    band,
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, v == null ? null : roundTo(v, 2)])),
    reasons,
    how_to_improve,
    note: "This is a heuristic confidence indicator, not a statistical probability of correctness.",
  };
}

function deficiencyFactor(rating) {
  if (rating === "low") return 1;
  if (rating === "medium") return 0.5;
  return 0.05;
}

function buildPlanItems(objective, doses, priceLookup) {
  // doses: { N: kg, P: kg, K: kg } amounts of pure nutrient still needed.
  const items = [];
  const push = (id, kgPerHa) => {
    if (kgPerHa <= 0.05) return;
    const fert = ALL_FERTILIZERS.find((f) => f.id === id);
    const cost_rs = roundTo(kgPerHa * priceLookup(id), 0);
    items.push({ fertilizer: fert.name, fertilizer_id: id, kg_per_ha: roundTo(kgPerHa, 1), cost_rs });
  };

  if (objective === "eco_inm") {
    // Organic-first: FYM/compost/vermicompost supply bulk N+organic matter,
    // biofertilizers substitute for part of N and P, neem urea tops up N.
    push("fym", doses.N * 18); // FYM ~0.5% N, bulky application
    push("vermicompost", doses.N * 4);
    push("rhizobium", doses.N > 0 ? 2 : 0);
    push("psb", doses.P > 0 ? 2 : 0);
    push("neem_urea", doses.N * 1.1); // remaining N, slow-release
    push("green_manure", doses.K > 0 ? 25 : 0);
    push("mop", doses.K * 0.8); // small conventional top-up for K, hard to avoid fully
  } else if (objective === "balanced_inm") {
    // Integrated: half organic, half conventional.
    push("fym", doses.N * 9);
    push("vermicompost", doses.N * 1.5);
    push("neem_urea", doses.N * 1.3);
    push("dap", doses.P * 2.2);
    push("mop", doses.K * 1.7);
  } else {
    // cheapest: mostly conventional chemical fertilizers sized to match nutrient need.
    push("urea", doses.N * 2.2);
    push("dap", doses.P * 2.2);
    push("mop", doses.K * 1.7);
  }
  return items;
}

function sustainabilityScoreFor(objective, totalKg, organicKg) {
  const organicShare = totalKg > 0 ? organicKg / totalKg : 0;
  const base = objective === "eco_inm" ? 82 : objective === "balanced_inm" ? 62 : 38;
  return clamp(Math.round(base + organicShare * 10 - 5), 15, 96);
}

function emissionsFor(objective, needN) {
  const perKgN = objective === "eco_inm" ? 2.4 : objective === "balanced_inm" ? 4.1 : 5.8;
  return Math.round(needN * perKgN);
}

export function postRecommend(payload) {
  const {
    crop = "rice",
    N = 200,
    P = 15,
    K = 120,
    district,
    lat,
    lon,
    texture,
    pH,
    OC,
    rain30,
    rain48,
    temp,
    target,
    objective = "balanced_inm",
    dap_change = 0,
    urea_change = 0,
    // Smart Farmer Mode (no lab soil report): N/P/K/pH/OC above are then an
    // *estimate* derived from farmer-reported observations rather than a lab
    // reading. input_mode/confidence/* are internal passthrough fields (not
    // part of the official backend contract) the UI uses to show an honest
    // confidence indicator and, when confidence is low, we deliberately keep
    // the suggested dose smaller/safer below.
    input_mode = "lab_report",
    confidence = "lab",
    confidence_notes = [],
    missing_info_suggestions = [],
  } = payload;

  const ctx = getContext({ lat, lon, district: district || undefined });
  const resolvedDistrict = district || ctx.district;
  const need = CROP_NUTRIENT_NEED[crop] || CROP_NUTRIENT_NEED.rice;

  // Weather Prediction Reliability & Multi-Source Verification: check how
  // well independent weather signals agree before trusting them to shape
  // the dose. See getWeatherReliability() for the scoring logic.
  const weatherReliability = getWeatherReliability(resolvedDistrict);

  const soil_rating = {
    N: ratingFor(N, SOIL_BANDS.N.lowMax, SOIL_BANDS.N.medMax),
    P: ratingFor(P, SOIL_BANDS.P.lowMax, SOIL_BANDS.P.medMax),
    K: ratingFor(K, SOIL_BANDS.K.lowMax, SOIL_BANDS.K.medMax),
  };

  // Early-warning prior: what weather + district history alone would have
  // suggested, before the farmer's own soil report is taken into account.
  const rng = rngFor(`prior:${resolvedDistrict}:${crop}`);
  const priorShift = (key) => (rng() > 0.78 ? (key === soil_rating[key[0]] ? 0 : 1) : 0);
  const early_warning_prior = {
    N: rng() > 0.75 ? (soil_rating.N === "low" ? "medium" : "low") : soil_rating.N,
    P: rng() > 0.8 ? (soil_rating.P === "low" ? "medium" : "low") : soil_rating.P,
    K: rng() > 0.8 ? (soil_rating.K === "low" ? "medium" : "low") : soil_rating.K,
  };
  const cross_check_notes = [];
  let weatherDisagreed = false;
  for (const nut of ["N", "P", "K"]) {
    if (early_warning_prior[nut] !== soil_rating[nut]) {
      weatherDisagreed = true;
      cross_check_notes.push(
        `Weather-based early warning suggested ${nut} might be "${early_warning_prior[nut]}", but your soil report shows "${soil_rating[nut]}".`
      );
    }
  }

  const no_deficiency = soil_rating.N === "high" && soil_rating.P === "high" && soil_rating.K === "high";

  // Weather + trend adjustment, capped at a 20% safety limit either way.
  const rain30Val = rain30 ?? ctx.weather.rain30;
  const rain48Val = rain48 ?? ctx.weather.rain48;
  const tempVal = temp ?? ctx.weather.temp;
  let weatherAdjPct = 0;
  const weather_and_trend_rules = [];
  if (rain30Val > 150) {
    weatherAdjPct -= 8;
    weather_and_trend_rules.push("High rainfall in the last 30 days increases nutrient leaching risk — dose nudged down by 8%.");
  } else if (rain30Val < 40) {
    weatherAdjPct += 5;
    weather_and_trend_rules.push("Low recent rainfall means less leaching — dose nudged up by 5%, within safe limits.");
  }
  if (ctx.trend.rain_trend === "decreasing") {
    weatherAdjPct += 4;
    weather_and_trend_rules.push("Local rainfall has been trending down over recent years — slightly higher retention assumed (+4%).");
  } else if (ctx.trend.rain_trend === "increasing") {
    weatherAdjPct -= 4;
    weather_and_trend_rules.push("Local rainfall has been trending up — slightly higher runoff risk assumed (−4%).");
  }
  if (tempVal > 32) {
    weatherAdjPct -= 3;
    weather_and_trend_rules.push("High temperature increases volatilisation risk for surface urea — dose nudged down by 3%.");
  }
  if (weatherReliability.confidence.level !== "high") {
    weather_and_trend_rules.push(
      `Weather sources showed ${weatherReliability.confidence.level} agreement (confidence ${weatherReliability.confidence.score}/100) — leaned toward a safer dose.`
    );
  }
  weatherAdjPct = clamp(weatherAdjPct, -20, 20);

  const targetYield = target || need.typicalTarget;
  const yieldRatio = clamp(targetYield / need.typicalTarget, 0.6, 1.6);

  // Smart Farmer Mode with low confidence (sparse/conflicting observations,
  // no lab report): err on the side of a smaller, safer correction rather
  // than committing to a full-strength dose off uncertain inputs.
  const conservativeFactor = input_mode === "farmer_observation" && confidence === "low" ? 0.6 : 1;

  // Weather Prediction Reliability: when weather sources disagree, don't let
  // an uncertain forecast drive an aggressive dose — back off proportionally.
  const weatherConservativeFactor =
    weatherReliability.confidence.level === "low" ? 0.6 : weatherReliability.confidence.level === "moderate" ? 0.85 : 1;

  const dose = {};
  for (const nut of ["N", "P", "K"]) {
    const factor = deficiencyFactor(soil_rating[nut]) * conservativeFactor * weatherConservativeFactor;
    const rawNeed = need[nut] * factor * yieldRatio;
    const adjusted = rawNeed * (1 + weatherAdjPct / 100);
    const cap = roundTo(need[nut] * factor * 1.3, 1);
    const point = roundTo(clamp(adjusted, 0, cap), 1);
    dose[nut] = {
      point,
      low: roundTo(point * 0.85, 1),
      high: roundTo(Math.min(point * 1.15, cap), 1),
      cap,
      weather_adjustment_pct: weatherAdjPct,
    };
  }

  const balance = [
    `${crop} at a target yield of about ${roundTo(targetYield, 1)} t/ha typically draws roughly N ${need.N}, P ${need.P}, K ${need.K} kg/ha at full fertility.`,
    `Your soil reads ${soil_rating.N} nitrogen, ${soil_rating.P} phosphorus and ${soil_rating.K} potassium, so we scaled the full requirement down accordingly.`,
  ];

  const priceLookup = (id) => {
    const base = ALL_FERTILIZERS.find((f) => f.id === id)?.pricePerKg ?? 10;
    if (id === "dap") return base * (1 + dap_change / 100);
    if (id === "urea" || id === "neem_urea") return base * (1 + urea_change / 100);
    return base;
  };

  function buildPlan(objectiveKey) {
    const doses = { N: dose.N.point, P: dose.P.point, K: dose.K.point };
    const items = buildPlanItems(objectiveKey, doses, priceLookup);
    const cost = items.reduce((s, it) => s + it.cost_rs, 0);
    const organicIds = new Set(SUSTAINABLE_FERTILIZERS.map((f) => f.id));
    const totalKg = items.reduce((s, it) => s + it.kg_per_ha, 0);
    const organicKg = items.filter((it) => organicIds.has(it.fertilizer_id)).reduce((s, it) => s + it.kg_per_ha, 0);
    const sustainability_score = sustainabilityScoreFor(objectiveKey, totalKg, organicKg);
    const ghg_kg_co2e_ha = emissionsFor(objectiveKey, dose.N.point);
    return {
      objective: objectiveKey,
      items,
      cost: roundTo(cost, 0),
      supply: { N: dose.N.point, P: dose.P.point, K: dose.K.point },
      sustainability_score,
      balanced_score: roundTo((sustainability_score + clamp(100 - cost / 30, 0, 100)) / 2, 0),
      ghg_kg_co2e_ha,
    };
  }

  const plans = {
    cheapest: buildPlan("cheapest"),
    balanced_inm: buildPlan("balanced_inm"),
    eco_inm: buildPlan("eco_inm"),
  };

  const plan = plans[objective] || plans.balanced_inm;
  const alternatives = Object.fromEntries(Object.entries(plans).filter(([k]) => k !== (objective || "balanced_inm")));

  // Price-rise alternative nudge: if urea/DAP are trending up, suggest the eco plan.
  const ureaTrend = getPriceTrend("urea");
  const dapTrend = getPriceTrend("dap");
  const price_signals = { urea: ureaTrend, dap: dapTrend };
  const price_alternative =
    (ureaTrend.direction === "up" || dapTrend.direction === "up") && objective !== "eco_inm"
      ? { objective: "eco_inm", reason: "DAP/Urea prices are trending up over the next 3 months.", plan: plans.eco_inm }
      : null;

  // Yield estimate with simple diminishing-returns curve.
  const fullDoseNeed = need.N + need.P * 2 + need.K; // weighted nutrient units
  const suppliedUnits = dose.N.point + dose.P.point * 2 + dose.K.point;
  const fulfilment = clamp(suppliedUnits / Math.max(fullDoseNeed, 1), 0, 1.3);
  const without_fertilizer_t_ha = roundTo(need.baseYield * 0.55, 2);
  const gain = roundTo(need.baseYield * 0.55 * fulfilment * 0.9, 2);
  const point_t_ha = roundTo(without_fertilizer_t_ha + gain, 2);
  const yieldSpread = roundTo(point_t_ha * 0.08, 2);

  const drivers = [
    { feature: "Soil nitrogen level", impact_t_ha: roundTo((soil_rating.N === "low" ? 0.35 : soil_rating.N === "medium" ? 0.15 : -0.05) * (need.baseYield / 3), 2), direction: soil_rating.N === "high" ? "lowers" : "raises" },
    { feature: "Recommended dose applied", impact_t_ha: roundTo(gain * 0.5, 2), direction: "raises" },
    { feature: `Rainfall last 30 days (${rain30Val} mm)`, impact_t_ha: roundTo(rain30Val > 150 ? -0.12 : rain30Val < 40 ? -0.08 : 0.08, 2), direction: rain30Val > 150 || rain30Val < 40 ? "lowers" : "raises" },
    { feature: `Temperature (${roundTo(tempVal, 1)}°C)`, impact_t_ha: roundTo(tempVal > 32 ? -0.1 : 0.04, 2), direction: tempVal > 32 ? "lowers" : "raises" },
    { feature: "Soil organic carbon", impact_t_ha: roundTo(((OC ?? ctx.soil_estimate.OC) - 0.5) * 0.3, 2), direction: (OC ?? ctx.soil_estimate.OC) >= 0.5 ? "raises" : "lowers" },
  ];

  const what_if_point_t_ha = {
    "N-20%": roundTo(point_t_ha - gain * 0.22, 2),
    current: point_t_ha,
    "N+20%": roundTo(point_t_ha + gain * 0.16, 2),
  };

  // Risk: proximity of chosen plan's nutrient supply to the safe cap.
  const capProximity = Math.max(
    dose.N.cap > 0 ? dose.N.point / dose.N.cap : 0,
    dose.P.cap > 0 ? dose.P.point / dose.P.cap : 0,
    dose.K.cap > 0 ? dose.K.point / dose.K.cap : 0
  );
  const riskScore = Math.round(clamp(capProximity * 100, 5, 99));
  const riskWarning = riskScore > 70 || (OC ?? ctx.soil_estimate.OC) < 0.35;
  const risk = {
    score: riskScore,
    limit: 100,
    warning: riskWarning,
    text: riskWarning
      ? "This plan is close to the safe application limit for your soil. We recommend a lab test before applying the full amount."
      : "This plan stays comfortably within safe application limits for your soil.",
    loop_back_tries: riskWarning ? 1 : 0,
  };

  const nutrient_use_efficiency = roundTo(clamp(0.9 - capProximity * 0.3, 0.35, 0.85), 2);
  const surplus_kg_ha = Math.max(0, roundTo(dose.N.point + dose.P.point + dose.K.point - fullDoseNeed * fulfilment, 1));
  const sustainability = {
    score: plan.sustainability_score,
    band: plan.sustainability_score >= 70 ? "Good" : plan.sustainability_score >= 45 ? "Moderate" : "Needs improvement",
    balanced_score: plan.balanced_score,
    nutrient_use_efficiency,
    surplus_kg_ha,
    ghg_kg_co2e_ha: plan.ghg_kg_co2e_ha,
    cost_efficiency: roundTo(point_t_ha / Math.max(plan.cost, 1) * 1000, 2),
  };

  const advice = [];
  const defer_application = rain48Val > 40 || weatherReliability.confidence.level === "low";
  if (rain48Val > 40) {
    advice.push("Heavy rain is expected in the next 48 hours — you may consider waiting a few days before applying, to reduce runoff.");
  }
  if (weatherReliability.confidence.level === "low") {
    advice.push(
      "Weather sources strongly disagree right now — you may consider postponing application until the forecast is clearer, or using the safer dose range."
    );
  } else if (weatherReliability.confidence.level === "moderate") {
    advice.push("Weather sources disagree somewhat — we used a safer dose and would suggest watching the forecast before applying.");
  }
  if (riskWarning) {
    advice.push("Consider a fresh soil lab test before applying the full recommended dose.");
  }
  if (weatherDisagreed) {
    advice.push("Weather-based early signals did not fully match your soil report — we followed your soil report as the more reliable source.");
  }
  if (!advice.length) {
    advice.push("Conditions look generally favourable for applying this plan as scheduled.");
  }
  if (input_mode === "farmer_observation" && confidence === "low") {
    advice.unshift(
      "Because your answers were sparse or mixed, we suggested a smaller, safer amount for now rather than a full-strength dose."
    );
  }

  const why = [
    `Your soil shows ${soil_rating.N} nitrogen, ${soil_rating.P} phosphorus and ${soil_rating.K} potassium for ${crop}.`,
    `We estimated a dose that should help close this gap, adjusted ${weatherAdjPct >= 0 ? "up" : "down"} by about ${Math.abs(weatherAdjPct)}% for recent weather and local trends.`,
    `We checked the plan against a safe application cap before finalising it.`,
  ];

  const confidenceScore = estimateConfidenceScore({
    inputMode: input_mode,
    smartFarmerConfidence: confidence,
    soilRating: soil_rating,
    earlyWarningPrior: early_warning_prior,
    pointTHa: point_t_ha,
    yieldSpread,
    N,
    P,
    K,
    pH,
    OC,
  });

  return {
    no_deficiency,
    message: no_deficiency
      ? "Your soil looks sufficient for now. We would suggest no fertilizer at the moment, and re-testing next season."
      : "We found room to improve nutrient balance for this crop.",
    soil_rating,
    early_warning_prior,
    cross_check_notes,
    dose,
    plan,
    alternatives,
    price_alternative,
    price_signals,
    yield_estimate: {
      low_t_ha: roundTo(point_t_ha - yieldSpread, 2),
      point_t_ha,
      high_t_ha: roundTo(point_t_ha + yieldSpread, 2),
      without_fertilizer_t_ha,
      expected_gain_t_ha: gain,
      drivers,
      what_if_point_t_ha,
    },
    risk,
    sustainability,
    confidence: confidenceScore,
    advice,
    defer_application,
    why,
    rule_trace: { balance, weather_and_trend_rules },
    climate_trend: ctx.trend,
    weather_reliability: weatherReliability,
    disclaimer:
      "These are estimates to guide you, not guaranteed results. A soil lab test and local agriculture officer advice are recommended.",
    confidence_meta: {
      input_mode,
      confidence,
      confidence_notes,
      missing_info_suggestions,
    },
    _context: ctx,
    _rotation_tips: ROTATION_TIPS[crop] || ROTATION_TIPS.default,
  };
}

export function postCompare(A, B) {
  const why_it_changed = [];
  if (A?.crop !== B?.crop) why_it_changed.push(`Crop differs (${A?.crop} vs ${B?.crop}), changing nutrient needs entirely.`);
  if (A?.objective !== B?.objective) why_it_changed.push(`Priorities differ (${A?.objective} vs ${B?.objective}), shifting which plan ranks first.`);
  if (A?.district !== B?.district) why_it_changed.push(`Location differs, so weather and typical prices differ.`);
  if (!why_it_changed.length) why_it_changed.push("Inputs were very similar — differences mainly come from minor weather or price variation.");
  return { A, B, why_it_changed };
}

export function postCropRecommend({ district, N, P, K, pH }) {
  const rng = rngFor(`croprec:${district}:${N}:${P}:${K}:${pH ?? 0}`);
  const shuffled = [...CROPS].sort(() => rng() - 0.5);
  const top_crops = shuffled.slice(0, 4).map((c, i) => ({ crop: c.id, probability: roundTo(0.85 - i * 0.17 - rng() * 0.05, 2) }));
  return { top_crops };
}

export function postParseReport(text) {
  const grab = (re, fallback) => {
    const m = String(text).match(re);
    return m ? parseFloat(m[1]) : fallback;
  };
  return {
    parsed: {
      N: grab(/N[:\s]+(\d+(\.\d+)?)/i, 200),
      P: grab(/P[:\s]+(\d+(\.\d+)?)/i, 15),
      K: grab(/K[:\s]+(\d+(\.\d+)?)/i, 120),
      pH: grab(/pH[:\s]+(\d+(\.\d+)?)/i, 6.8),
      OC: grab(/OC[:\s]+(\d+(\.\d+)?)/i, 0.5),
    },
  };
}
