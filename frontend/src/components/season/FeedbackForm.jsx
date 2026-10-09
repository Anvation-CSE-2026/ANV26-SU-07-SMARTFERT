import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody } from "../common/Card";
import { Button } from "../common/Button";
import { api } from "../../api/client";

const ISSUES = ["yellowing", "lodging", "runoff_event"];

export function FeedbackForm({ recommendationId, onDone, onCancel }) {
  const { t } = useTranslation();
  const [appliedStatus, setAppliedStatus] = useState("yes");
  const [issues, setIssues] = useState([]);
  const [actualYield, setActualYield] = useState("");
  const [retestN, setRetestN] = useState("");
  const [retestP, setRetestP] = useState("");
  const [retestK, setRetestK] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function toggleIssue(id) {
    setIssues((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  async function submit() {
    setBusy(true);
    const retest = {};
    if (retestN !== "") retest.N = Number(retestN);
    if (retestP !== "") retest.P = Number(retestP);
    if (retestK !== "") retest.K = Number(retestK);
    const payload = {
      recommendation_id: recommendationId,
      applied_status: appliedStatus,
      issues,
      actual_yield_t_ha: actualYield !== "" ? Number(actualYield) : undefined,
      retest: Object.keys(retest).length ? retest : undefined,
      rating: rating || undefined,
    };
    const { data } = await api.postFeedback(payload);
    setBusy(false);
    setResult(data);
    if (data.available !== false) {
      setTimeout(() => onDone?.(), 1500);
    }
  }

  if (result) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-green-800">
            {result.available === false ? result.note : result.verified ? t("feedback.thanksVerified") : t("feedback.thanksUnverified")}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="font-semibold text-green-900">{t("feedback.title")}</p>

        <div>
          <label className="text-xs font-medium text-green-800 block mb-1">{t("feedback.appliedStatus")}</label>
          <div className="flex gap-2">
            {["yes", "partly", "no"].map((s) => (
              <button
                key={s}
                onClick={() => setAppliedStatus(s)}
                className={`flex-1 text-sm px-2 py-2 rounded-xl border ${
                  appliedStatus === s ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"
                }`}
              >
                {t(`feedback.status${s[0].toUpperCase()}${s.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-green-800 block mb-1">{t("feedback.issues")}</label>
          <div className="flex flex-wrap gap-2">
            {ISSUES.map((i) => (
              <button
                key={i}
                onClick={() => toggleIssue(i)}
                aria-pressed={issues.includes(i)}
                className={`text-sm px-3 py-1.5 rounded-full border ${
                  issues.includes(i) ? "bg-amber-500 text-white border-amber-500" : "bg-white text-green-700 border-green-200"
                }`}
              >
                {t(`feedback.issue${i.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("")}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-green-800 block mb-1">{t("feedback.actualYield")}</label>
          <input
            type="number"
            value={actualYield}
            onChange={(e) => setActualYield(e.target.value)}
            placeholder={t("feedback.actualYieldPlaceholder")}
            className="w-full rounded-xl border border-green-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-green-800 block mb-1">{t("feedback.retest")}</label>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={retestN} onChange={(e) => setRetestN(e.target.value)} placeholder="N" className="rounded-xl border border-green-200 px-2 py-2 text-sm" />
            <input type="number" value={retestP} onChange={(e) => setRetestP(e.target.value)} placeholder="P" className="rounded-xl border border-green-200 px-2 py-2 text-sm" />
            <input type="number" value={retestK} onChange={(e) => setRetestK(e.target.value)} placeholder="K" className="rounded-xl border border-green-200 px-2 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-green-800 block mb-1">{t("feedback.rating")}</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`} className="text-2xl leading-none">
                {n <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-green-700/60">{t("feedback.disclaimer")}</p>

        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? t("common.loading") : t("feedback.submit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
