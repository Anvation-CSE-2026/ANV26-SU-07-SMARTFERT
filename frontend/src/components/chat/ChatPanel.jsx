import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../common/Button";
import { api } from "../../api/client";
import { useAppStore } from "../../store/useAppStore";
import { SUPPORTED_LANGUAGES } from "../../i18n";

const SPEECH_LOCALE = { en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN" };

export function ChatPanel({ onClose }) {
  const { t, i18n } = useTranslation();
  const lastResult = useAppStore((s) => s.lastResult);
  const recommendationId = lastResult?.recommendation_id;

  const [language, setLanguage] = useState(i18n.language);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [feedback, setFeedback] = useState({});
  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    api.getChatSuggestions({ recommendation_id: recommendationId, language }).then(({ data }) => {
      setSuggestions(data.available ? data.suggestions : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendationId, language]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    const userMsg = { id: Date.now(), role: "user", text: message };
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    const { data } = await api.postChat({ message, language, recommendation_id: recommendationId, history });
    setMessages((m) => [...m, { id: Date.now() + 1, role: "assistant", text: data.reply, grounded_on: data.grounded_on, fallback: data.fallback }]);
    setSending(false);
  }

  function toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = SPEECH_LOCALE[language] || "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function readAloud(msg) {
    if (!("speechSynthesis" in window)) return;
    if (speakingId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    const utter = new window.SpeechSynthesisUtterance(msg.text);
    utter.lang = SPEECH_LOCALE[language] || "en-IN";
    utter.onend = () => setSpeakingId(null);
    window.speechSynthesis.speak(utter);
    setSpeakingId(msg.id);
  }

  function giveFeedback(msgId, value) {
    setFeedback((f) => ({ ...f, [msgId]: value }));
  }

  const speechSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={t("chat.title")}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col h-[85vh] sm:h-[600px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-100">
          <div>
            <p className="font-semibold text-green-900">{t("chat.title")}</p>
            <p className="text-[11px] text-green-700/60">{t("chat.disclaimer")}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-xs rounded-full border border-green-200 px-2 py-1 bg-white"
              aria-label={t("common.language")}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
            <button onClick={onClose} className="text-green-700/60 hover:text-green-900 text-xl leading-none" aria-label={t("common.close")}>
              ×
            </button>
          </div>
        </div>

        {recommendationId && (
          <p className="text-[11px] text-green-700/60 px-4 pt-2">{t("chat.sourceTag", { id: recommendationId })}</p>
        )}

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-green-700/60 py-6">{t("chat.greeting")}</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-green-600 text-white" : "bg-mint-50 text-green-900 border border-green-100"
                }`}
              >
                <p>{m.text}</p>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {ttsSupported && (
                      <button onClick={() => readAloud(m)} className="text-xs text-green-700/60 hover:text-green-900" aria-label={t("common.readAloud")}>
                        🔊
                      </button>
                    )}
                    <button
                      onClick={() => giveFeedback(m.id, "up")}
                      className={`text-xs ${feedback[m.id] === "up" ? "opacity-100" : "opacity-50"} hover:opacity-100`}
                      aria-label="Helpful"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => giveFeedback(m.id, "down")}
                      className={`text-xs ${feedback[m.id] === "down" ? "opacity-100" : "opacity-50"} hover:opacity-100`}
                      aria-label="Not helpful"
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && <div className="text-xs text-green-700/50">{t("common.loading")}</div>}
        </div>

        {suggestions.length > 0 && messages.length === 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 -mx-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s.text)}
                className="shrink-0 text-xs rounded-full border border-green-200 bg-mint-50 px-3 py-1.5 text-green-800 hover:bg-green-100"
              >
                {s.text}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3 border-t border-green-100">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("chat.inputPlaceholder")}
            className="flex-1 rounded-xl border border-green-200 px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
          />
          {speechSupported && (
            <button
              onClick={toggleVoiceInput}
              aria-pressed={listening}
              className={`rounded-xl border px-3 py-2.5 ${listening ? "bg-red-50 border-red-300 text-red-600" : "bg-white border-green-200 text-green-700"}`}
              title={t("smartFarmer.voiceInput")}
            >
              🎤
            </button>
          )}
          <Button size="md" onClick={() => send()} disabled={sending || !input.trim()}>
            {t("chat.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
