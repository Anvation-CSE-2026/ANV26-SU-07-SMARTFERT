import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { OfflineBanner } from "../components/common/Misc";
import { LocationPicker } from "../components/layout/LocationPicker";
import { WeatherCard } from "../components/dashboard/WeatherCard";
import { PriceList } from "../components/dashboard/PriceList";
import { CropGrid } from "../components/dashboard/CropGrid";
import { SavedScenariosCard } from "../components/dashboard/SavedScenariosCard";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import { DISTRICTS } from "../data/staticData";

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useAppStore((s) => s.location);
  const setDraftInput = useAppStore((s) => s.setDraftInput);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [usedMock, setUsedMock] = useState(false);

  useEffect(() => {
    if (!location) {
      setPickerOpen(true);
      setLoadingContext(false);
    }
  }, [location]);

  useEffect(() => {
    if (!location) return;
    let active = true;
    setLoadingContext(true);
    (async () => {
      const { data, isUnexpectedFallback } = await api.getContext(location.lat, location.lon, location.district);
      if (!active) return;
      setContext(data);
      setUsedMock(isUnexpectedFallback);
      setLoadingContext(false);
    })();
    return () => {
      active = false;
    };
  }, [location]);

  function openInputFresh() {
    setDraftInput({});
    navigate("/input");
  }

  return (
    <div className="space-y-5">
      <LocationPicker open={pickerOpen} onClose={() => setPickerOpen(false)} districts={DISTRICTS} />

      <OfflineBanner show={usedMock} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-gradient-to-br from-green-600 to-green-700 text-white border-none">
          <CardBody className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-semibold">{t("dashboard.getRecommendation")}</h2>
              <p className="text-green-50/90 text-sm mt-1.5 max-w-md">{t("dashboard.getRecommendationDesc")}</p>
            </div>
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-green-700 hover:bg-green-50 shrink-0"
              onClick={openInputFresh}
            >
              {t("dashboard.startButton")} →
            </Button>
          </CardBody>
        </Card>

        <SavedScenariosCard />
      </div>

      {location && (
        <div className="flex items-center justify-between text-sm text-green-800/80 px-1">
          <span>
            {t("location.locationSet")} <strong>{location.district}</strong>
          </span>
          <button onClick={() => setPickerOpen(true)} className="font-medium text-green-700 hover:underline">
            {t("common.changeLocation")}
          </button>
        </div>
      )}

      {location && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WeatherCard loading={loadingContext} context={context} />
          <PriceList />
        </div>
      )}

      {location && <CropGrid />}
    </div>
  );
}
