// Static reference data for the mock-data layer and UI dropdowns.
// Mirrors the shape /api/meta would return from the real Flask backend.

export const DISTRICTS = [
  { name: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lon: 76.9558 },
  { name: "Thanjavur", state: "Tamil Nadu", lat: 10.787, lon: 79.1378 },
  { name: "Madurai", state: "Tamil Nadu", lat: 9.9252, lon: 78.1198 },
  { name: "Guntur", state: "Andhra Pradesh", lat: 16.3067, lon: 80.4365 },
  { name: "Krishna", state: "Andhra Pradesh", lat: 16.2096, lon: 81.1377 },
  { name: "Warangal", state: "Telangana", lat: 17.9689, lon: 79.5941 },
  { name: "Nalgonda", state: "Telangana", lat: 17.0575, lon: 79.2683 },
  { name: "Mysuru", state: "Karnataka", lat: 12.2958, lon: 76.6394 },
  { name: "Bengaluru Rural", state: "Karnataka", lat: 13.0, lon: 77.5 },
  { name: "Belagavi", state: "Karnataka", lat: 15.8497, lon: 74.4977 },
  { name: "Palakkad", state: "Kerala", lat: 10.7867, lon: 76.6548 },
  { name: "Alappuzha", state: "Kerala", lat: 9.4981, lon: 76.3388 },
  { name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lon: 80.9462 },
  { name: "Meerut", state: "Uttar Pradesh", lat: 28.9845, lon: 77.7064 },
  { name: "Indore", state: "Madhya Pradesh", lat: 22.7196, lon: 75.8577 },
  { name: "Jaipur", state: "Rajasthan", lat: 26.9124, lon: 75.7873 },
  { name: "Patna", state: "Bihar", lat: 25.5941, lon: 85.1376 },
  { name: "Ludhiana", state: "Punjab", lat: 30.901, lon: 75.8573 },
  { name: "Nashik", state: "Maharashtra", lat: 19.9975, lon: 73.7898 },
  { name: "Rajkot", state: "Gujarat", lat: 22.3039, lon: 70.8022 },
];

export const TEXTURES = ["sandy", "loam", "clay"];

export const OBJECTIVES = ["cheapest", "balanced_inm", "eco_inm"];

// `season` is shown as-is (not yet translated per-language - see i18n TODO in src/i18n/index.js).
// Crop display names come from the `crops.*` i18n namespace, keyed by `id`.
// `id` is the lowercase convention used throughout this UI and the mock engine.
// The real Flask backend's crop_requirements.csv indexes by Title Case instead
// (e.g. "Rice", not "rice") - BACKEND_CROP_NAME below maps one to the other;
// see api/client.js, which applies it only on the real HTTP call.
export const CROPS = [
  { id: "rice", season: "Kharif (Jun-Nov)", water: "high" },
  { id: "wheat", season: "Rabi (Nov-Apr)", water: "medium" },
  { id: "maize", season: "Kharif / Rabi", water: "medium" },
  { id: "cotton", season: "Kharif (May-Dec)", water: "medium" },
  { id: "groundnut", season: "Kharif (Jun-Oct)", water: "low" },
  { id: "sugarcane", season: "Year-round", water: "high" },
  { id: "ragi", season: "Kharif (Jun-Oct)", water: "low" },
  { id: "chickpea", season: "Rabi (Oct-Mar)", water: "low" },
];

export const BACKEND_CROP_NAME = {
  rice: "Rice",
  wheat: "Wheat",
  maize: "Maize",
  cotton: "Cotton",
  groundnut: "Groundnut",
  sugarcane: "Sugarcane",
  ragi: "Ragi",
  chickpea: "Chickpea",
};

// Typical full-dose nutrient need per crop at medium target yield, kg/ha.
// Used by the mock recommendation engine to size doses when soil is deficient.
export const CROP_NUTRIENT_NEED = {
  rice: { N: 120, P: 60, K: 40, baseYield: 3.2, typicalTarget: 5.5, typicalCostPerHa: 4800 },
  wheat: { N: 110, P: 55, K: 35, baseYield: 2.6, typicalTarget: 4.5, typicalCostPerHa: 4200 },
  maize: { N: 135, P: 65, K: 45, baseYield: 3.0, typicalTarget: 6.0, typicalCostPerHa: 5200 },
  cotton: { N: 100, P: 50, K: 50, baseYield: 1.0, typicalTarget: 2.2, typicalCostPerHa: 6500 },
  groundnut: { N: 25, P: 50, K: 40, baseYield: 1.2, typicalTarget: 2.4, typicalCostPerHa: 3000 },
  sugarcane: { N: 220, P: 90, K: 90, baseYield: 55, typicalTarget: 90, typicalCostPerHa: 9500 },
  ragi: { N: 45, P: 30, K: 25, baseYield: 1.3, typicalTarget: 2.3, typicalCostPerHa: 2200 },
  chickpea: { N: 20, P: 45, K: 25, baseYield: 1.0, typicalTarget: 1.9, typicalCostPerHa: 2000 },
};

export const SUSTAINABLE_FERTILIZERS = [
  { id: "vermicompost", name: "Vermicompost", pricePerKg: 8.5, nutrient: "organic" },
  { id: "compost", name: "Compost", pricePerKg: 4.0, nutrient: "organic" },
  { id: "fym", name: "Farmyard manure (FYM)", pricePerKg: 2.5, nutrient: "organic" },
  { id: "green_manure", name: "Green manure (Dhaincha / Sunhemp seed)", pricePerKg: 60, nutrient: "organic" },
  { id: "rhizobium", name: "Rhizobium (biofertilizer)", pricePerKg: 180, nutrient: "N-fixing" },
  { id: "psb", name: "PSB (Phosphate Solubilising Bacteria)", pricePerKg: 160, nutrient: "P" },
  { id: "azotobacter", name: "Azotobacter (biofertilizer)", pricePerKg: 170, nutrient: "N-fixing" },
  { id: "neem_urea", name: "Neem-coated urea (slow release)", pricePerKg: 6.8, nutrient: "N" },
];

export const CONVENTIONAL_FERTILIZERS = [
  { id: "urea", name: "Urea", pricePerKg: 6.0, nutrient: "N" },
  { id: "dap", name: "DAP", pricePerKg: 27.5, nutrient: "N+P" },
  { id: "mop", name: "MOP (Muriate of Potash)", pricePerKg: 18.0, nutrient: "K" },
  { id: "ssp", name: "SSP (Single Super Phosphate)", pricePerKg: 9.5, nutrient: "P" },
  { id: "npk_complex", name: "NPK Complex (10:26:26)", pricePerKg: 24.0, nutrient: "N+P+K" },
];

export const ALL_FERTILIZERS = [...SUSTAINABLE_FERTILIZERS, ...CONVENTIONAL_FERTILIZERS];

// Smart Farmer Mode (no lab soil report): option lists for the farmer-friendly
// questionnaire used to produce a preliminary soil estimate. Labels are i18n
// keys under the "smartFarmer" namespace.
export const IRRIGATION_LEVELS = ["none", "rainfed", "partial", "full"];
export const FERTILIZER_HISTORY_OPTIONS = ["none", "organic", "chemical", "both"];
export const YIELD_PERFORMANCE_OPTIONS = ["poor", "average", "good", "unsure"];
export const SYMPTOM_OPTIONS = ["yellowing", "stunted", "poor_flowering", "purplish", "scorch", "none"];
export const DRAINAGE_OPTIONS = ["waterlogged", "normal", "well"];

// General local-guidance rotation tips, keyed by crop just harvested.
// Labelled "general guidance" in the UI — not a personalised agronomic plan.
export const ROTATION_TIPS = {
  rice: [
    { id: "legume", text: "After rice, consider a legume such as green gram or chickpea to help restore soil nitrogen." },
    { id: "compost", text: "Add compost or FYM before the next sowing to help rebuild organic carbon used up by rice." },
    { id: "retest", text: "Re-test your soil next season — paddy fields often show changing phosphorus and potassium levels." },
    { id: "avoid_repeat", text: "Try to avoid repeating rice for too many seasons in a row on the same plot without a break crop." },
  ],
  wheat: [
    { id: "legume", text: "Consider rotating with a pulse crop like chickpea or lentil to naturally add nitrogen back." },
    { id: "oc", text: "Mixing in green manure can help rebuild organic carbon depleted by continuous cereal cropping." },
    { id: "retest", text: "Re-test soil nutrients before the next wheat cycle, especially phosphorus." },
  ],
  maize: [
    { id: "legume", text: "A legume rotation (groundnut, green gram) after maize can help balance nitrogen use." },
    { id: "residue", text: "Returning crop residue as mulch can help maintain organic carbon." },
    { id: "retest", text: "Re-test soil next season, as maize is a heavy nutrient feeder." },
  ],
  cotton: [
    { id: "legume", text: "Rotating with a pulse or groundnut crop may help restore soil nitrogen after cotton." },
    { id: "oc", text: "Adding compost can help counter the heavy nutrient draw of cotton." },
    { id: "retest", text: "Re-test soil before the next cotton season to avoid over-applying." },
  ],
  default: [
    { id: "legume", text: "Consider rotating with a nitrogen-fixing legume such as green gram or chickpea next season." },
    { id: "compost", text: "Adding compost or farmyard manure can help build organic carbon over time." },
    { id: "retest", text: "Re-testing your soil each season helps keep fertilizer doses accurate." },
    { id: "avoid_repeat", text: "Avoid growing the same heavy-nutrient crop repeatedly without a break crop." },
  ],
};
