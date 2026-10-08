import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";

export function LanguageSwitcher({ compact = false }) {
  const { i18n, t } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  function choose(code) {
    i18n.changeLanguage(code);
    setLanguage(code, true);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("common.language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-50 min-h-[40px]"
      >
        <span aria-hidden="true">🌐</span>
        {!compact && <span>{current.native}</span>}
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 w-44 bg-white border border-green-100 rounded-xl shadow-lg overflow-hidden z-50"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === current.code}
                onClick={() => choose(l.code)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 ${l.code === current.code ? "bg-green-50 font-semibold text-green-800" : "text-green-900"}`}
              >
                {l.native}
                <span className="text-xs text-green-700/60 ml-1">({l.label})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
