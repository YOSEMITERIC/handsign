"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { LM, orientNormalizeWorld, toVec63 } from "@/lib/hand/normalize";
import { meanVec, rmsdVec } from "@/lib/hand/stats";
import { loadDatasetFromDisk } from "@/lib/gesture/storage";
import { checkWord, getLastWordAtCursor, replaceLastWordAtCursor } from "@/lib/spell/api";

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
  const [language, setLanguage] = useState<string>("auslan");
  const [side, setSide] = useState<"left" | "right">("left");

  // dataset / centroids
  const [dataset, setDataset] = useState<Dataset>({});
  const [centroids, setCentroids] = useState<Record<string, number[]>>({});
  const [ready, setReady] = useState(false);

  // live letters
  const [streamText, setStreamText] = useState("");
  const lastEmitLabelRef = useRef<string>("");
  const voteBufRef = useRef<string[]>([]);
  const threshold = 0.12;

  // voting params
  const SAMPLE_MS = 100;
  const WINDOW_MS = 1000;
  const WINDOW_N = Math.max(1, Math.round(WINDOW_MS / SAMPLE_MS));
  const REQUIRED_RATIO = 0.8;

  // spellcheck (khi nhận SPACE)
  const [spellSuggestions, setSpellSuggestions] = useState<string[]>([]);
  const [lastCheckedWord, setLastCheckedWord] = useState<string>("");
  const [spellLoading, setSpellLoading] = useState(false);
  const [spellError, setSpellError] = useState<string | null>(null);
  const spellCache = useRef<Map<string, { misspelled: boolean; suggestions: string[] }>>(new Map());
  // NEW: giữ gợi ý trong ref để interval luôn thấy phiên bản mới nhất
  const spellSugRef = useRef<string[]>([]);
  useEffect(() => {
    spellSugRef.current = spellSuggestions;
  }, [spellSuggestions]);

  // load dataset theo language/side
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

  // spellcheck helper
  async function checkWordFromStream(text: string) {
    const word = getLastWordAtCursor(text, text.length);
    if (!word) { setLastCheckedWord(""); setSpellSuggestions([]); return; }
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
    } catch (e:any) {
      setSpellLoading(false);
      setSpellError(e?.message || "Spell API error");
    }
  }

  function applySuggestionToStream(idx: number) {
    const sug = spellSugRef.current[idx];
    if (!sug) return;
    const { text } = replaceLastWordAtCursor(streamText, streamText.length, sug);
    setStreamText(text);
    setSpellSuggestions([]);
    setLastCheckedWord(sug);
  }

  // camera loop
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      recogRef.current = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
        },
        numHands: 1,
        runningMode: "VIDEO",
      });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setReady(true);

      const loop = () => {
        if (cancelled) return;
        const video = videoRef.current!, canvas = canvasRef.current!, ctx = canvas.getContext("2d")!;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const res = recogRef.current!.recognizeForVideo(video, performance.now());
        const hasHand = !!(res.worldLandmarks && res.worldLandmarks[0]?.length);
        if (hasHand) {
          lastWLRef.current = res.worldLandmarks![0] as LM;
          lastHandRef.current = (res.handednesses?.[0]?.[0]?.categoryName as any) ?? "Unknown";
        } else {
          lastWLRef.current = null; lastHandRef.current = "Unknown";
        }

        // vẽ 2D nhẹ
        if (res.landmarks?.length) {
          ctx.fillStyle = "#10B981";
          for (const p of res.landmarks[0]) { ctx.beginPath(); ctx.arc(p.x*canvas.width, p.y*canvas.height, 4, 0, Math.PI*2); ctx.fill(); }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    })().catch(console.error);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const s = videoRef.current?.srcObject as MediaStream | null;
      s?.getTracks().forEach(t => t.stop());
      recogRef.current?.close();
    };
  }, []);

  // voting mỗi SAMPLE_MS
  useEffect(() => {
    const id = setInterval(async () => {
      const wl = lastWLRef.current; if (!wl) return;
      const keys = Object.keys(centroids); if (!keys.length) return;

      const norm = orientNormalizeWorld(wl, lastHandRef.current, { mirrorLeft: false });
      const vec = toVec63(norm);

      let best = "", bestD = Infinity;
      for (const k of keys) {
        const d = rmsdVec(vec, centroids[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      const candidate = bestD <= threshold ? best : "Nope";

      const buf = voteBufRef.current;
      buf.push(candidate);
      if (buf.length > WINDOW_N) buf.shift();

      if (buf.length === WINDOW_N) {
        const freq = new Map<string, number>();
        for (const lab of buf) freq.set(lab, (freq.get(lab)||0)+1);

        let top = "", cnt = 0;
        for (const [lab, c] of freq) { if (lab==="Nope") continue; if (c>cnt){cnt=c; top=lab;} }
        const ratio = top ? cnt/WINDOW_N : 0;

        if (top && ratio >= REQUIRED_RATIO && top !== lastEmitLabelRef.current) {
          if (top === "SPACE") {
            const nt = streamText + " ";
            setStreamText(nt);
            await checkWordFromStream(nt);
          } else if (top.toUpperCase() === "DELETE") {
            setStreamText(s => (s ? s.slice(0,-1) : s));
            setSpellSuggestions([]); setLastCheckedWord("");
          } else if (/^OP[1-5]$/i.test(top)) {
            const idx = parseInt(top.slice(2),10)-1;
            applySuggestionToStream(idx); // ← dùng ref nên luôn thấy gợi ý mới nhất
          } else {
            setStreamText(s => s + top);
          }
          lastEmitLabelRef.current = top;
          voteBufRef.current = [];
        }
      }
    }, SAMPLE_MS);
    return () => clearInterval(id);
    // lưu deps gọn: không cần phụ thuộc spellSuggestions nữa vì đã dùng ref
  }, [centroids, language, side, streamText]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {/* Top controls: Language & Side */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span>Language:</span>
          <select value={language} onChange={e=>setLanguage(e.target.value)} className="border rounded px-2 py-1">
            <option value="auslan">Auslan</option>
            <option value="american">American</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span>Side:</span>
          <select value={side} onChange={e=>setSide(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
        <span className="ml-auto text-xs">{ready ? "Camera: Ready" : "Camera: Loading…"}</span>
      </div>

      {/* Camera */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow">
        <video ref={videoRef} className="hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Live letters */}
      <div className="border rounded p-3">
        <div className="text-sm font-semibold mb-2">
          Live letters — {language}/{side}
        </div>
        <div className="min-h-[2.5rem] px-2 py-1 bg-gray-50 rounded font-mono text-lg">
          {streamText || "—"}
        </div>

        <div className="mt-3 text-sm flex items-center gap-2">
          <b>Spellcheck:</b>
          {spellLoading ? <span>checking…</span> : lastCheckedWord ? <span>last: <i>{lastCheckedWord}</i></span> : <span>—</span>}
          {spellError && <span className="text-red-500">• {spellError}</span>}
          {spellSuggestions.length > 0 && (
            <span className="ml-2 text-xs text-gray-600">Use OP1…OP5 gestures to pick suggestions.</span>
          )}
        </div>

        {spellSuggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {spellSuggestions.slice(0,5).map((s,i)=>(
              <span key={s} className={`px-2 py-1 border rounded ${i===0?"bg-black text-white":""}`}>
                {i+1}. {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
