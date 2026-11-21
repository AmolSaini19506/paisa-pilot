"use client";
import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Voice input via the browser's built-in speech recognition (free, no key). Hindi + English. */
export default function MicButton({ onText, onFinal }: { onText: (t: string) => void; onFinal?: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const [lang, setLang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [supported, setSupported] = useState(true);
  const rec = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e: any) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      finalText = txt;
      onText(txt);
    };
    r.onend = () => { setOn(false); if (finalText && onFinal) onFinal(finalText); };
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };
  const stop = () => { rec.current?.stop(); setOn(false); };

  if (!supported) return null;
  return (
    <div className="row" style={{ gap: 6 }}>
      <button type="button" className="btn sm ghost" onClick={() => setLang(lang === "en-IN" ? "hi-IN" : "en-IN")} title="Switch speech language" aria-label="Switch speech language">
        {lang === "en-IN" ? "EN" : "हि"}
      </button>
      <button type="button" className={`btn ${on ? "purple mic-live" : "ghost"}`} onClick={on ? stop : start} aria-label={on ? "Stop listening" : "Speak your question"} title={on ? "Stop" : "Speak (Hindi or English)"}>
        {on ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
    </div>
  );
}
