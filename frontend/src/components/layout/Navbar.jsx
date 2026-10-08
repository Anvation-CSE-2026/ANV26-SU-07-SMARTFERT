import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MockToggle } from "./MockToggle";
import { useAppStore } from "../../store/useAppStore";

export function Navbar() {
  const { t } = useTranslation();
  const location = useAppStore((s) => s.location);

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? "bg-green-100 text-green-800" : "text-green-700/80 hover:bg-green-50 hover:text-green-800"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-green-100 no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl" aria-hidden="true">🌾</span>
          <span className="font-semibold text-green-900 text-base sm:text-lg leading-tight">
            {t("common.appName")}
          </span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          <NavLink to="/" className={linkClass} end>
            {t("nav.dashboard")}
          </NavLink>
          <NavLink to="/input" className={linkClass}>
            {t("nav.newRecommendation")}
          </NavLink>
          <NavLink to="/compare" className={linkClass}>
            {t("nav.compare")}
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {location && (
            <span className="hidden sm:inline text-sm text-green-700/70 max-w-[160px] truncate" title={location.district}>
              📍 {location.district}
            </span>
          )}
          <MockToggle />
          <LanguageSwitcher compact />
        </div>
      </div>
      <nav className="md:hidden flex items-center justify-around border-t border-green-100 bg-white" aria-label="Primary mobile">
        <NavLink to="/" className={linkClass} end>
          {t("nav.dashboard")}
        </NavLink>
        <NavLink to="/input" className={linkClass}>
          {t("nav.newRecommendation")}
        </NavLink>
        <NavLink to="/compare" className={linkClass}>
          {t("nav.compare")}
        </NavLink>
      </nav>
    </header>
  );
}
