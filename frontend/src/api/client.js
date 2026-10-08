import axios from "axios";
import * as mock from "./mockEngine";
import { BACKEND_CROP_NAME } from "../data/staticData";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MOCK_TOGGLE_KEY = "fya_force_mock";
const CLIENT_ID_KEY = "fya_client_id";

function uuidv4() {
  // crypto.randomUUID is available in all browsers this app targets; this
  // template-based fallback only kicks in for older/unusual environments.
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Anonymous client id - generated once per browser, stored in localStorage,
// sent as X-Client-Id on every request so the backend can scope History,
// Fields and feedback to "this farmer" without ever asking for a name, phone
// number or exact address.
export function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return uuidv4(); // private browsing / storage disabled: still works, just not remembered
  }
}

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
http.interceptors.request.use((cfg) => {
  cfg.headers["X-Client-Id"] = getClientId();
  return cfg;
});

export function isLiveBackendConfigured() {
  return Boolean(API_BASE) && !isMockForced();
}

// This app's convention is a lowercase crop id ("rice") everywhere - the
// select options, the mock engine, saved scenarios/history. The real Flask
// backend's crop_requirements.csv indexes by Title Case ("Rice") instead.
// Translate only on the way out to the real HTTP call; the mock path and
// everything the UI stores locally keep the lowercase id untouched.
function toBackendCrop(payload) {
  if (!payload || typeof payload.crop !== "string") return payload;
  const mapped = BACKEND_CROP_NAME[payload.crop.toLowerCase()];
  return mapped ? { ...payload, crop: mapped } : payload;
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
      () => http.post("/api/recommend", toBackendCrop(payload)),
      () => mock.postRecommend(payload)
    ),

  postCompare: (A, B) =>
    callOrMock(
      () => http.post("/api/compare", { A: toBackendCrop(A), B: toBackendCrop(B) }),
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

  // --- History & Fields: server-side, per-client only. There is no sensible
  // offline mock for a multi-client history (it lives in the backend's DB by
  // design), so these degrade to a clearly-flagged "not available offline"
  // shape instead of pretending to persist anything. The My Season page falls
  // back to the existing localStorage "scenarios" list in that case.
  getHistory: (params) =>
    callOrMock(
      () => http.get("/api/history", { params }),
      () => ({ available: false, items: [], note: "History needs a connection to the server." })
    ),

  getHistoryItem: (id) => callOrMock(() => http.get(`/api/history/${id}`), () => { throw new Error("History is not available offline."); }),

  patchHistoryStatus: (id, status) =>
    callOrMock(
      () => http.patch(`/api/history/${id}/status`, { status }),
      () => { throw new Error("Can't update status offline."); }
    ),

  postApplication: (id, payload) =>
    callOrMock(
      () => http.post(`/api/history/${id}/applications`, payload),
      () => { throw new Error("Can't log an application offline."); }
    ),

  deleteHistoryItem: (id) =>
    callOrMock(
      () => http.delete(`/api/history/${id}`),
      () => { throw new Error("Can't delete offline."); }
    ),

  exportHistoryCsvUrl: () => `${API_BASE}/api/history/export.csv`,

  getFields: () => callOrMock(() => http.get("/api/fields"), () => []),

  postField: (payload) =>
    callOrMock(
      () => http.post("/api/fields", payload),
      () => { throw new Error("Can't save a field offline."); }
    ),
};
