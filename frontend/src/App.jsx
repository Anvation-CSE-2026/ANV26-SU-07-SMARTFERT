import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "./components/layout/Navbar";
import { useAppStore } from "./store/useAppStore";
import Dashboard from "./pages/Dashboard";
import InputPage from "./pages/Input";
import Recommendation from "./pages/Recommendation";
import Explain from "./pages/Explain";
import Comparison from "./pages/Comparison";
import Season from "./pages/Season";

export default function App() {
  const { i18n } = useTranslation();
  const language = useAppStore((s) => s.language);

  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-mint-50 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/input" element={<InputPage />} />
            <Route path="/recommendation" element={<Recommendation />} />
            <Route path="/explain" element={<Explain />} />
            <Route path="/compare" element={<Comparison />} />
            <Route path="/season" element={<Season />} />
          </Routes>
        </main>
        <footer className="no-print text-center text-xs text-green-700/50 py-6">
          🌱 {i18n.t("common.appName")} — {i18n.t("common.tagline")}
        </footer>
      </div>
    </HashRouter>
  );
}
