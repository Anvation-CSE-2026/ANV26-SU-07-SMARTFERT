import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState, OfflineBanner } from "../components/common/Misc";
import { SeasonSummary } from "../components/season/SeasonSummary";
import { SeasonTimelineItem } from "../components/season/SeasonTimelineItem";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import { CROPS } from "../data/staticData";

const SEASONS = ["Kharif", "Rabi", "Zaid"];

// Mirrors backend data/seasons.csv - only used so the (offline) local-scenario
// fallback can still be filtered by season on the client.
function seasonForDate(date) {
  const m = date.getMonth() + 1;
  if (m >= 6 && m <= 10) return "Kharif";
  if (m >= 11 || m <= 3) return "Rabi";
  return "Zaid";
}

function normalizeServerItem(raw) {
  return { ...raw, source: "server" };
}

function normalizeLocalScenario(sc) {
  return {
    id: sc.id,
    source: "local",
    crop: sc.input?.crop,
    season: seasonForDate(new Date(sc.createdAt)),
    created_at: new Date(sc.createdAt).toISOString(),
    status: "planned",
    confidence: sc.result?.confidence?.score ?? null,
    sustainability: sc.result?.sustainability?.score ?? null,
    cost: sc.result?.plan?.cost ?? null,
    simulated: false,
    applications: [],
    raw: sc,
  };
}

export default function Season() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scenarios = useAppStore((s) => s.scenarios);
  const deleteScenario = useAppStore((s) => s.deleteScenario);
  const setDraftInput = useAppStore((s) => s.setDraftInput);

  const [loading, setLoading] = useState(true);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [offline, setOffline] = useState(false);
  const [serverItems, setServerItems] = useState([]);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [cropFilter, setCropFilter] = useState("all");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, isUnexpectedFallback } = await api.getHistory();
      if (!active) return;
      setOffline(isUnexpectedFallback);
      if (data.available) {
        setServerAvailable(true);
        setServerItems(data.items.map(normalizeServerItem));
      } else {
        setServerAvailable(false);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => {
    const base = serverAvailable ? serverItems : scenarios.map(normalizeLocalScenario);
    return base
      .filter((i) => seasonFilter === "all" || i.season === seasonFilter)
      .filter((i) => cropFilter === "all" || (i.crop || "").toLowerCase() === cropFilter)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [serverAvailable, serverItems, scenarios, seasonFilter, cropFilter]);

  async function handleStatusChange(id, status) {
    setServerItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await api.patchHistoryStatus(id, status);
  }

  async function handleLogApplication(id, payload) {
    try {
      const { data } = await api.postApplication(id, payload);
      setServerItems((prev) => prev.map((i) => (i.id === id ? { ...i, applications: [...(i.applications || []), data] } : i)));
    } catch {
      /* offline - the button itself is hidden for local items, so this only fires if the connection just dropped */
    }
  }

  async function handleDelete(item) {
    if (item.source === "server") {
      await api.deleteHistoryItem(item.id);
      setServerItems((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      deleteScenario(item.id);
    }
  }

  async function handleReuse(item) {
    if (item.source === "server") {
      const { data } = await api.getHistoryItem(item.id);
      setDraftInput(data.inputs);
    } else {
      setDraftInput(item.raw.input);
    }
    navigate("/input");
  }

  function handleExport() {
    if (serverAvailable) {
      window.open(api.exportHistoryCsvUrl(), "_blank");
      return;
    }
    const header = "id,created_at,season,crop,status,confidence,sustainability,cost_rs_per_ha\n";
    const rows = items.map((i) => [i.id, i.created_at, i.season, i.crop, i.status, i.confidence, i.sustainability, i.cost].join(","));
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-season-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cropOptions = useMemo(() => CROPS.map((c) => ({ value: c.id, label: t(`crops.${c.id}`) })), [t]);

  if (loading) {
    return <p className="text-center text-green-700/60 py-10">{t("common.loading")}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold text-green-900">{t("season.title")}</h1>
        <Button size="sm" variant="secondary" onClick={handleExport}>
          {t("season.export")}
        </Button>
      </div>

      <OfflineBanner show={offline} />
      {!serverAvailable && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          📱 {t("season.localFallbackNote")}
        </p>
      )}

      <Card>
        <CardBody className="flex flex-wrap gap-3">
          <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className="rounded-xl border border-green-200 px-3 py-2 text-sm bg-white">
            <option value="all">{t("season.allSeasons")}</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)} className="rounded-xl border border-green-200 px-3 py-2 text-sm bg-white">
            <option value="all">{t("dashboard.allCrops")}</option>
            {cropOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </CardBody>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon="🗓️" title={t("season.empty")} body={t("season.emptyBody")} />
      ) : (
        <>
          <SeasonSummary items={items} />
          <div className="space-y-3">
            {items.map((item) => (
              <SeasonTimelineItem
                key={`${item.source}-${item.id}`}
                item={item}
                onStatusChange={handleStatusChange}
                onLogApplication={handleLogApplication}
                onDelete={handleDelete}
                onReuse={handleReuse}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
