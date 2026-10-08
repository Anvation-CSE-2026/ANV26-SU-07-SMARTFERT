import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { fmtCurrency, cropLabel } from "../../utils/format";

const STATUS_TONE = { planned: "mint", applied: "green", partially: "amber", skipped: "gray" };

export function SeasonTimelineItem({ item, onStatusChange, onLogApplication, onDelete, onReuse }) {
  const { t } = useTranslation();
  const [loggingApp, setLoggingApp] = useState(false);
  const [appDate, setAppDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appNote, setAppNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitApplication() {
    setBusy(true);
    await onLogApplication(item.id, { date: appDate, items: appNote ? [{ note: appNote }] : [] });
    setBusy(false);
    setLoggingApp(false);
    setAppNote("");
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-green-900">{cropLabel(t, item.crop)}</p>
              {item.simulated && <Badge tone="amber">{t("season.demoBadge")}</Badge>}
              {item.season && <Badge tone="mint">{item.season}</Badge>}
            </div>
            <p className="text-xs text-green-700/60 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
          </div>
          {item.source === "server" ? (
            <select
              value={item.status}
              onChange={(e) => onStatusChange(item.id, e.target.value)}
              className="text-xs rounded-full border border-green-200 px-2 py-1 bg-white text-green-800"
            >
              {["planned", "applied", "partially", "skipped"].map((s) => (
                <option key={s} value={s}>
                  {t(`season.status${s[0].toUpperCase()}${s.slice(1)}`)}
                </option>
              ))}
            </select>
          ) : (
            <Badge tone={STATUS_TONE[item.status] || "gray"}>{t(`season.status${(item.status || "planned")[0].toUpperCase()}${(item.status || "planned").slice(1)}`)}</Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-mint-50 rounded-lg p-2">
            <p className="text-[11px] text-green-700/60">{t("season.cost")}</p>
            <p className="text-sm font-semibold text-green-900">{item.cost != null ? fmtCurrency(item.cost) : "—"}</p>
          </div>
          <div className="bg-mint-50 rounded-lg p-2">
            <p className="text-[11px] text-green-700/60">{t("season.sustainability")}</p>
            <p className="text-sm font-semibold text-green-900">{item.sustainability != null ? `${Math.round(item.sustainability)}/100` : "—"}</p>
          </div>
          <div className="bg-mint-50 rounded-lg p-2">
            <p className="text-[11px] text-green-700/60">{t("season.confidence")}</p>
            <p className="text-sm font-semibold text-green-900">{item.confidence != null ? `${Math.round(item.confidence)}/100` : "—"}</p>
          </div>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => onReuse(item)}>
            {t("season.reuseInputs")}
          </Button>
          {item.source === "server" && (
            <Button size="sm" variant="ghost" onClick={() => setLoggingApp((o) => !o)}>
              {t("season.logApplication")}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDelete(item)}>
            {t("common.delete")}
          </Button>
        </div>

        {loggingApp && (
          <div className="mt-3 bg-mint-50 rounded-xl p-3 space-y-2">
            <input
              type="date"
              value={appDate}
              onChange={(e) => setAppDate(e.target.value)}
              className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={appNote}
              onChange={(e) => setAppNote(e.target.value)}
              placeholder={t("season.applicationNotePlaceholder")}
              className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm"
            />
            <Button size="sm" onClick={submitApplication} disabled={busy}>
              {busy ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        )}

        {item.applications?.length > 0 && (
          <ul className="mt-3 text-xs text-green-700/70 space-y-0.5">
            {item.applications.map((a) => (
              <li key={a.id}>
                ✓ {a.date} {a.items?.[0]?.note ? `— ${a.items[0].note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
