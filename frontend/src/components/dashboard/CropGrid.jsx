import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CROPS, CROP_NUTRIENT_NEED } from "../../data/staticData";
import { useAppStore } from "../../store/useAppStore";

const WATER_TONE = { low: "mint", medium: "amber", high: "green" };

export function CropGrid() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setDraftInput = useAppStore((s) => s.setDraftInput);
  const [filter, setFilter] = useState("all");

  const visible = filter === "all" ? CROPS : CROPS.filter((c) => c.id === filter);

  function startFor(crop) {
    setDraftInput({ crop: crop.id });
    navigate("/input");
  }

  return (
    <Card>
      <CardHeader title={t("dashboard.cropsTitle")} subtitle={t("dashboard.generalInfoNote")} icon="🌾" />
      <CardBody>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          <button
            onClick={() => setFilter("all")}
            className={`shrink-0 text-sm px-3 py-1.5 rounded-full border ${filter === "all" ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"}`}
          >
            {t("dashboard.allCrops")}
          </button>
          {CROPS.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`shrink-0 text-sm px-3 py-1.5 rounded-full border ${filter === c.id ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"}`}
            >
              {t(`crops.${c.id}`)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((crop) => {
            const need = CROP_NUTRIENT_NEED[crop.id];
            return (
              <div key={crop.id} className="rounded-xl border border-green-100 p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-green-900">{t(`crops.${crop.id}`)}</p>
                  <Badge tone={WATER_TONE[crop.water]}>{t(`dashboard.water${crop.water[0].toUpperCase()}${crop.water.slice(1)}`)}</Badge>
                </div>
                <p className="text-xs text-green-700/70">
                  {t("dashboard.typicalSeason")}: {crop.season}
                </p>
                <p className="text-sm text-green-800">
                  {t("dashboard.costPerHectare")}: <span className="font-medium">₹{need.typicalCostPerHa.toLocaleString("en-IN")}</span>
                </p>
                <Button size="sm" variant="secondary" onClick={() => startFor(crop)} className="mt-1">
                  {t("dashboard.startForThisCrop")}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-green-700/60 mt-3">{t("common.typicalValue")}</p>
      </CardBody>
    </Card>
  );
}
