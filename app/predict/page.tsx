"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { LM, orientNormalizeWorld, toVec63 } from "@/lib/hand/normalize";
import { meanVec, rmsdVec } from "@/lib/hand/stats";
import { loadDatasetFromDisk } from "@/lib/gesture/storage";
import { speakText } from "@/lib/speech/speak";

import {
  checkWord,
  getLastWordAtCursor,
  replaceLastWordAtCursor,
  checkGrammar,
} from "@/lib/spell/api";
import { applyReplacementsDesc } from "@/lib/spell/utils";
import { Footer, Header } from "@/components";

type Dataset = Record<string, number[][]>;

export default function PredictPage() {
  // camera + mediapipe
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recogRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number>();
  const lastWLRef = useRef<LM | null>(null);
  const lastHandRef = useRef<"Left" | "Right" | "Unknown">("Unknown");

  // chọn ngôn ngữ + tay
  const [language, setLanguage] = useState<string>("american");
  const [side, setSide] = useState<"left" | "right">("left");

  // dataset / centroids
  const [dataset, setDataset] = useState<Dataset>({});
  const [centroids, setCentroids] = useState<Record<string, number[]>>({});
  const centroidsRef = useRef<Record<string, number[]>>({});
  useEffect(() => { centroidsRef.current = centroids; }, [centroids]);

  const [ready, setReady] = useState(false);

  // live letters
  const [streamText, setStreamText] = useState("");
  const streamTextRef = useRef(streamText);
  useEffect(() => { streamTextRef.current = streamText; }, [streamText]);

  const lastEmitLabelRef = useRef<string>("");
  const voteBufRef = useRef<string[]>([]);
  const threshold = 0.12;

  // voting params
  const SAMPLE_MS = 100;
  const WINDOW_MS = 800;
  const WINDOW_N = Math.max(1, Math.round(WINDOW_MS / SAMPLE_MS));
  const REQUIRED_RATIO = 0.8;

  // SPACE double-stage
  const spaceStageRef = useRef<0 | 1>(0);

  // spellcheck
  const [spellSuggestions, setSpellSuggestions] = useState<string[]>([]);
  const [lastCheckedWord, setLastCheckedWord] = useState<string>("");
  const [spellLoading, setSpellLoading] = useState(false);
  const [spellError, setSpellError] = useState<string | null>(null);
  const spellCache = useRef<Map<string, { misspelled: boolean; suggestions: string[] }>>(new Map());
  const spellSugRef = useRef<string[]>([]);
  useEffect(() => { spellSugRef.current = spellSuggestions; }, [spellSuggestions]);

  // Grammar: SEND + UNDO
  const grammarInFlightRef = useRef(false);
  const [grammarStatus, setGrammarStatus] = useState<"" | "checking" | "done" | "error">("");
  const undoStackRef = useRef<string[]>([]);

  // 🔊 SPEAK state
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const st = () => setSpeaking(true);
    const ed = () => setSpeaking(false);
    speechSynthesis.addEventListener("start", st);
    speechSynthesis.addEventListener("end", ed);
    return () => {
      speechSynthesis.removeEventListener("start", st);
      speechSynthesis.removeEventListener("end", ed);
    };
  }, []);

  // Load dataset
  useEffect(() => {
    (async () => {
      try {
        const ds = await loadDatasetFromDisk(side, language);
        setDataset(ds);
      } catch (e) {
        console.warn("load dataset failed", e);
      }
    })();
  }, [language, side]);

  useEffect(() => {
    const c: Record<string, number[]> = {};
    for (const [k, arr] of Object.entries(dataset)) if (arr.length) c[k] = meanVec(arr);
    setCentroids(c);
  }, [dataset]);

  // Spell helper
  async function checkWordFromStream(text: string) {
    const word = getLastWordAtCursor(text, text.length);
    if (!word) {
      setLastCheckedWord("");
      setSpellSuggestions([]);
      return;
    }
    const key = word.toLowerCase();
    if (spellCache.current.has(key)) {
      const v = spellCache.current.get(key)!;
      setLastCheckedWord(word);
      setSpellSuggestions(v.misspelled ? v.suggestions : []);
      return;
    }
    try {
      setSpellLoading(true);
      setSpellError(null);
      const res = await checkWord(word);
      spellCache.current.set(key, res);
      setLastCheckedWord(word);
      setSpellSuggestions(res.misspelled ? res.suggestions : []);
      setSpellLoading(false);
    } catch (e: any) {
      setSpellLoading(false);
      setSpellError(e?.message || "Spell API error");
    }
  }

  function applySuggestionToStream(idx: number) {
    const sug = spellSugRef.current[idx];
    if (!sug) return;
    const { text } = replaceLastWordAtCursor(streamTextRef.current, streamTextRef.current.length, sug);
    setStreamText(text);
    setSpellSuggestions([]);
    setLastCheckedWord(sug);
  }

  // SEND grammar
  async function sendAllGrammarOnce() {
    if (grammarInFlightRef.current) return;
    const raw = streamTextRef.current;
    if (!raw.trim()) return;

    grammarInFlightRef.current = true;
    setGrammarStatus("checking");
    undoStackRef.current.push(raw);

    try {
      const locale = language === "american" ? "en-US" : "en-AU";
      const { matches } = await checkGrammar(raw, locale);
      const reps = (matches || [])
        .map((m: any) => {
          const rep = m?.replacements?.[0]?.value;
          if (!rep) return null;
          return { offset: m.offset || 0, length: m.length || 0, replacement: rep };
        })
        .filter(Boolean);
      const fx = applyReplacementsDesc(streamTextRef.current, 0, reps);
      setStreamText(fx);
      setGrammarStatus("done");
      setTimeout(() => setGrammarStatus(""), 1200);
    } catch {
      setGrammarStatus("error");
      setTimeout(() => setGrammarStatus(""), 1200);
    } finally {
      grammarInFlightRef.current = false;
    }
  }

  function undoLastGrammar() {
    const prev = undoStackRef.current.pop();
    if (prev) setStreamText(prev);
  }

  // Camera + recognize
  useEffect(() => {
    let stop = false;

    (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      if (recogRef.current) try { await recogRef.current.close(); } catch {}
      recogRef.current = null;

      const wantHands = language === "american" ? 1 : 2;

      recogRef.current = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
        },
        numHands: wantHands,
        runningMode: "VIDEO",
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setReady(true);

      const loop = () => {
        if (stop) return;
        const video = videoRef.current!, canvas = canvasRef.current!, ctx = canvas.getContext("2d")!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const res = recogRef.current!.recognizeForVideo(video, performance.now());
        const hasHand = !!(res.worldLandmarks && res.worldLandmarks[0]?.length);
        if (hasHand) {
          lastWLRef.current = res.worldLandmarks![0] as LM;
          lastHandRef.current = res.handednesses?.[0]?.[0]?.categoryName ?? "Unknown";
        } else {
          lastWLRef.current = null;
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      stop = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const s = videoRef.current?.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
      recogRef.current?.close();
    };
  }, [language]);

  // Voting interval
  const hasIntervalRef = useRef(false);
  useEffect(() => {
    if (hasIntervalRef.current) return;
    hasIntervalRef.current = true;

    const id = setInterval(async () => {
      const wl = lastWLRef.current;
      if (!wl) return;

      const keys = Object.keys(centroidsRef.current);
      if (!keys.length) return;

      const norm = orientNormalizeWorld(wl, lastHandRef.current, { mirrorLeft: false });
      const vec = toVec63(norm);

      let best = "", bestD = Infinity;
      for (const k of keys) {
        const d = rmsdVec(vec, centroidsRef.current[k]);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }

      const candidate = bestD <= threshold ? best : "Nope";
      const buf = voteBufRef.current;
      buf.push(candidate);
      if (buf.length > WINDOW_N) buf.shift();

      if (buf.length === WINDOW_N) {
        const freq = new Map<string, number>();
        for (const l of buf) freq.set(l, (freq.get(l) || 0) + 1);

        let top = "", cnt = 0;
        for (const [l, c] of freq) if (l !== "Nope" && c > cnt) { top = l; cnt = c; }
        const ratio = cnt / WINDOW_N;

        if (!top || ratio < REQUIRED_RATIO) return;

        // ================= LABEL HANDLING =================

        // ✅ SPEAK
        if (top.toUpperCase() === "SPEAK") {
          speakText(streamTextRef.current, "american");
          lastEmitLabelRef.current = "SPEAK";
          voteBufRef.current = [];
          spaceStageRef.current = 0;
          return;
        }

        // SEND
        if (top.toUpperCase() === "SEND") {
          await sendAllGrammarOnce();
          lastEmitLabelRef.current = "SEND";
          voteBufRef.current = [];
          spaceStageRef.current = 0;
          return;
        }

        // UNDO
        if (top.toUpperCase() === "UNDO") {
          undoLastGrammar();
          lastEmitLabelRef.current = "UNDO";
          voteBufRef.current = [];
          spaceStageRef.current = 0;
          return;
        }

        // DELETE repeat allowed
        if (top.toUpperCase() === "DELETE") {
          setStreamText((s) => (/\.\s$/.test(s) ? s.slice(0,-2) : s.slice(0,-1)));
          setSpellSuggestions([]);
          setLastCheckedWord("");
          lastEmitLabelRef.current = "";
          voteBufRef.current = [];
          return;
        }

        // SPACE double-stage
        if (top === "SPACE") {
          if (spaceStageRef.current === 0) {
            const nt = streamTextRef.current.endsWith(" ") ? streamTextRef.current : streamTextRef.current + " ";
            setStreamText(nt);
            await checkWordFromStream(nt);
            spaceStageRef.current = 1;
            lastEmitLabelRef.current = "SPACE";
            voteBufRef.current = [];
            return;
          } else {
            const ft = streamTextRef.current.replace(/\s+$/, "") + ". ";
            setStreamText(ft);
            spaceStageRef.current = 0;
            lastEmitLabelRef.current = "SPACE";
            voteBufRef.current = [];
            return;
          }
        }

        // OP1..OP5 or normal characters
        if (top !== lastEmitLabelRef.current) {
          if (/^OP[1-5]$/i.test(top)) {
            applySuggestionToStream(parseInt(top.slice(2),10)-1);
          } else {
            setStreamText((s) => s + top);
          }
          spaceStageRef.current = 0;
          lastEmitLabelRef.current = top;
          voteBufRef.current = [];
        }
      }
    }, SAMPLE_MS);

    return () => {
      clearInterval(id);
      hasIntervalRef.current = false;
    };
  }, []);

return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-white to-white text-slate-900 isolate">
      <Header />

      <div className="mx-auto max-w-5xl p-4 sm:p-6 my-6 sm:my-10 space-y-5 sm:space-y-6">
        {/* Language & Side */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 sm:gap-6 md:gap-8 text-sm sm:text-base font-medium">
          <label className="flex items-center gap-2">
            <span>Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 px-4 rounded-xl border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="auslan">Auslan</option>
              <option value="american">American</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span>Side:</span>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as any)}
              className="h-10 px-4 rounded-xl border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

          <div className="w-full md:w-auto md:ml-auto mt-2 md:mt-0 flex items-center gap-2 text-[14px] sm:text-[15px] font-medium">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`} />
            <span className="truncate">{ready ? "Camera: Ready" : "Camera: Loading…"}</span>
          </div>
        </div>

        {/* Camera */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-3 sm:p-4">
          <div
            className="
              relative overflow-hidden rounded-xl bg-black shadow-sm
              h-[58vh] min-h-[320px]               /* on phones */
              sm:h-[400px] md:h-[460px] lg:h-[520px] /* desktop/laptop sizes */
              max-h-[calc(100vh-220px)]            /* avoid pushing under footer on tiny screens */
            "
          >
            <video ref={videoRef} className="hidden" playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          </div>
        </div>

        {/* Live letters + Speak on the same row */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-700">
              Live letters — <span className="font-normal text-slate-600">{language}/{side}</span>
            </div>
            <button
              onClick={() => speakText(streamTextRef.current, "american")}
              className="text-xl"
              title="Speak"
            >
              🔊
            </button>
          </div>

          <div className="min-h-[2.5rem] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg">
            {streamText || "—"}
          </div>

          {speaking && <div className="mt-1 text-xs text-emerald-600 font-medium">Speaking…</div>}
          {/* Grammar status */}
          <div className="mt-2 text-xs text-slate-600">
            {grammarStatus === "checking" && "Grammar: checking…"}
            {grammarStatus === "done" && "Grammar: applied ✅"}
            {grammarStatus === "error" && "Grammar: failed ❌"}
          </div>

          {/* Spell */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-800">
            <b>Spellcheck:</b>
            {spellLoading ? <span>checking…</span> :
             lastCheckedWord ? <span>last: <i>{lastCheckedWord}</i></span> : <span>—</span>}
            {spellError && <span className="text-red-500">• {spellError}</span>}
            {spellSuggestions.length > 0 && (
              <span className="text-xs text-slate-600">Use OP1…OP5 gestures to pick suggestions.</span>
            )}
          </div>

          {spellSuggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {spellSuggestions.slice(0, 5).map((s, i) => (
                <span
                  key={s}
                  className={`px-2 py-1 border border-slate-200 rounded-lg text-sm ${
                    i === 0 ? "bg-black text-white" : "bg-slate-50"
                  }`}
                >
                  {i + 1}. {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
