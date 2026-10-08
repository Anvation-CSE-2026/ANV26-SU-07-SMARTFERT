import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "../common/Card";
import { Badge } from "../common/Badge";
import { CardSkeleton } from "../common/Skeleton";

function trendBadgeKey(prefix, trend) {
  if (trend === "increasing") return `${prefix}TrendUp`;
  if (trend === "decreasing") return `${prefix}TrendDown`;
  return `${prefix}TrendStable`;
}

export function WeatherCard({ loading, context }) {
  const { t } = useTranslation();
  if (loading || !context) return <CardSkeleton lines={4} />;

  const { weather, trend } = context;

  return (
    <Card>
      <CardHeader title={t("dashboard.weatherTitle")} icon="⛅" />
      <CardBody>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-semibold text-green-900">{weather.temp}°C</div>
            <div className="text-xs text-green-700/70 mt-0.5">{t("dashboard.currentTemp")}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-green-900">{weather.rain30}mm</div>
            <div className="text-xs text-green-700/70 mt-0.5">{t("dashboard.rainfall30")}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-green-900">{weather.rain48}mm</div>
            <div className="text-xs text-green-700/70 mt-0.5">{t("dashboard.rainOutlook48")}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge tone={trend.rain_trend === "decreasing" ? "amber" : "mint"}>
            🌧️ {t(`dashboard.${trendBadgeKey("rain", trend.rain_trend)}`)}
          </Badge>
          <Badge tone={trend.temp_trend === "increasing" ? "amber" : "mint"}>
            🌡️ {t(`dashboard.${trendBadgeKey("temp", trend.temp_trend)}`)}
          </Badge>
        </div>
        <p className="text-xs text-green-700/60 mt-3">
          {t("common.typicalValue")} · {t("common.dataSource")}: {weather.source}
        </p>
      </CardBody>
    </Card>
  );
}
