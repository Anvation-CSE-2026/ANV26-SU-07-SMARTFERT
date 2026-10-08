import axios from "axios";
import * as mock from "./mockEngine";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MOCK_TOGGLE_KEY = "fya_force_mock";

export function isMockForced() {
  try {
    return localStorage.getItem(MOCK_TOGGLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMockForced(value) {
  try {
    localStorage.setItem(MOCK_TOGGLE_KEY, value ? "1" : "0");
  } catch {
    /* ignore (private browsing / storage disabled) */
  }
}

const http = axios.create({ baseURL: API_BASE, timeout: 6000 });

export function isLiveBackendConfigured() {
  return Boolean(API_BASE) && !isMockForced();
}

// Every exported call below tries the real backend first (unless mock mode
// is forced, or VITE_API_URL is empty) and transparently falls back to the
// mock engine on any failure, so the UI never hard-fails when the API is
// offline. `usedMock` is true whenever mock data was used; `isUnexpectedFallback`
// is only true when a *configured* backend failed at request time (as opposed
// to mock mode being the deliberate default with no backend set up at all) —
// that distinction is what the UI uses to decide whether to show the
// "could not reach live data" warning banner.
async function callOrMock(realCall, mockCall) {
  if (!API_BASE) {
    return { data: mockCall(), usedMock: true, isUnexpectedFallback: false };
  }
  if (isMockForced()) {
    return { data: mockCall(), usedMock: true, isUnexpectedFallback: true };
  }
  try {
    const { data } = await realCall();
    return { data, usedMock: false, isUnexpectedFallback: false };
  } catch (err) {
    console.warn("[api] falling back to mock data:", err?.message);
    return { data: mockCall(), usedMock: true, isUnexpectedFallback: true };
  }
}

export const api = {
  getMeta: () => callOrMock(() => http.get("/api/meta"), () => mock.getMeta()),

  getContext: (lat, lon, district) =>
    callOrMock(
      () => http.get("/api/context", { params: { lat, lon, district } }),
      () => mock.getContext({ lat, lon, district })
    ),

  getPriceTrend: (fertilizer) =>
    callOrMock(
      () => http.get("/api/price-trend", { params: { fertilizer } }),
      () => mock.getPriceTrend(fertilizer)
    ),

  getClimateTrend: (district) =>
    callOrMock(
      () => http.get("/api/climate-trend", { params: { district } }),
      () => mock.getClimateTrend(district)
    ),

  getScenarios: () => callOrMock(() => http.get("/api/scenarios"), () => mock.getScenarios()),

  getModelInfo: () => callOrMock(() => http.get("/api/model-info"), () => mock.getModelInfo()),

  postRecommend: (payload) =>
    callOrMock(
      () => http.post("/api/recommend", payload),
      () => mock.postRecommend(payload)
    ),

  postCompare: (A, B) =>
    callOrMock(
      () => http.post("/api/compare", { A, B }),
      () => mock.postCompare(A, B)
    ),

  postCropRecommend: (payload) =>
    callOrMock(
      () => http.post("/api/crop-recommend", payload),
      () => mock.postCropRecommend(payload)
    ),

  postParseReport: (text, file) =>
    callOrMock(
      () => {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          return http.post("/api/parse-report", form, { headers: { "Content-Type": "multipart/form-data" } });
        }
        return http.post("/api/parse-report", { text });
      },
      () => mock.postParseReport(text || "")
    ),
};
