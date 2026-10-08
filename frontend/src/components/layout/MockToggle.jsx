import { useState } from "react";
import { isMockForced, setMockForced, isLiveBackendConfigured } from "../../api/client";

// Lets a developer/tester flip between the live Flask API and the mock-data
// layer at runtime. Hidden entirely when no VITE_API_URL is configured at
// all, since there is nothing to toggle back to in that case.
export function MockToggle() {
  const [forced, setForced] = useState(isMockForced());
  const hasBackend = Boolean(import.meta.env.VITE_API_URL);

  if (!hasBackend) {
    return (
      <span className="hidden lg:inline text-xs text-green-700/50 px-2" title="No VITE_API_URL configured — running entirely on mock data">
        🧪 Demo data
      </span>
    );
  }

  function toggle() {
    const next = !forced;
    setMockForced(next);
    setForced(next);
    window.location.reload();
  }

  return (
    <button
      onClick={toggle}
      className="hidden lg:inline text-xs rounded-full border border-green-200 px-2.5 py-1 text-green-700 hover:bg-green-50"
      title="Switch between the live API and mock data"
    >
      {isLiveBackendConfigured() ? "🟢 Live API" : "🧪 Mock data"}
    </button>
  );
}
