import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Button } from "../common/Button";
import { SelectInput, NumberInput } from "../input/Field";
import { api } from "../../api/client";
import { CROPS } from "../../data/staticData";
import { fmtCurrency } from "../../utils/format";

export function WhatIfPanel({ baseInput, baseResult }) {
  const { t } = useTranslation();
  const [rain30, setRain30] = useState(baseInput.rain30 ?? "");
  const [crop, setCrop] = useState(baseInput.crop);
  const [dapChange, setDapChange] = useState(baseInput.dap_change ?? 0);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState(null);

  async function rerun() {
    setLoading(true);
    const payload = { ...baseInput, rain30: rain30 === "" ? undefined : Number(rain30), crop, dap_change: Number(dapChange) || 0 };
    const { data } = await api.postRecommend(payload);
    setComparison(data);
    setLoading(false);
  }

  const cropOptions = CROPS.map((c) => ({ value: c.id, label: t(`crops.${c.id}`) }));

  return (
    <Card>
      <CardHeader title={t("explain.whatIfPanel")} icon="🔁" />
      <CardBody>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-green-800 block mb-1">{t("explain.whatIfRain")} (mm)</label>
            <NumberInput value={rain30} onChange={setRain30} min={0} />
          </div>
          <div>
            <label className="text-xs font-medium text-green-800 block mb-1">{t("explain.whatIfCrop")}</label>
            <SelectInput value={crop} onChange={setCrop} options={cropOptions} />
          </div>
          <div>
            <label className="text-xs font-medium text-green-800 block mb-1">{t("explain.whatIfPrice")} (DAP %)</label>
            <NumberInput value={dapChange} onChange={setDapChange} min={-50} max={50} unit="%" />
          </div>
        </div>
        <Button size="sm" onClick={rerun} disabled={loading}>
          {loading ? t("common.loading") : t("explain.rerun")}
        </Button>

        {comparison && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-mint-50 rounded-xl p-3">
              <p className="text-xs text-green-700/70 mb-1">Before</p>
              <p className="font-semibold text-green-900">{baseResult.yield_estimate.point_t_ha} t/ha</p>
              <p className="text-green-800">{fmtCurrency(baseResult.plan.cost)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-green-700/70 mb-1">After</p>
              <p className="font-semibold text-green-900">{comparison.yield_estimate.point_t_ha} t/ha</p>
              <p className="text-green-800">{fmtCurrency(comparison.plan.cost)}</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
