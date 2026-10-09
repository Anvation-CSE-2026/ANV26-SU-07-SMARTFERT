import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatPanel } from "./ChatPanel";

export function ChatButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-green-600 text-white shadow-lg flex items-center justify-center text-2xl hover:bg-green-700 transition-colors"
        aria-label={t("chat.title")}
        title={t("chat.title")}
      >
        💬
      </button>
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}
