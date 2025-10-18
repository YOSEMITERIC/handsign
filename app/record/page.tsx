"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { LM, orientNormalizeWorld, toVec63 } from "@/lib/hand/normalize";
import { saveLabelToDisk, loadDatasetFromDisk } from "@/lib/gesture/storage";
import Header from "@/components/Header";
import { Footer } from "@/components";

type Dataset = Record<string, number[][]>;

export default function RecordPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recogRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number>();
  const startBtnRef = useRef<HTMLButtonElement>(null);

  const lastWLRef = useRef<LM | null>(null);
  const lastHandRef = useRef<"Left" | "Right" | "Unknown">("Unknown");

  const [language, setLanguage] = useState<string>("auslan");
  const [side, setSide] = useState<"left" | "right">("left");
  const [label, setLabel] = useState<string>("Input the Label");
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string>("—");
  const [countOnDisk, setCountOnDisk] = useState<number>(0);

  // camera
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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setReady(true);

      const loop = () => {
        if (cancelled) return;
        const v = videoRef.current!,
          c = canvasRef.current!,
          ctx = c.getContext("2d")!;
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, c.width, c.height);

        const res = recogRef.current!.recognizeForVideo(v, performance.now());

        const ok = !!(res.worldLandmarks && res.worldLandmarks[0]?.length);
        if (ok) {
          lastWLRef.current = res.worldLandmarks![0] as LM;
          // FIX: dùng handednesses
          const handedName =
            (res.handednesses?.[0]?.[0]?.categoryName as "Left" | "Right" | undefined) ??
            "Unknown";
          lastHandRef.current = handedName;
        } else {
          lastWLRef.current = null;
          lastHandRef.current = "Unknown";
        }

        // draw 2D
        if (res.landmarks?.length) {
          ctx.fillStyle = "#10B981";
          for (const p of res.landmarks[0]) {
            ctx.beginPath();
            ctx.arc(p.x * c.width, p.y * c.height, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    })().catch(console.error);

    // ENTER => capture sample (prevent default to avoid clicking focused button)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!isRecording) return;

        const wl = lastWLRef.current;
        if (!wl) {
          setMsg("No hand");
          return;
        }
        const normLM = orientNormalizeWorld(wl, lastHandRef.current, {
          mirrorLeft: false,
        });
        const vec63 = toVec63(normLM);
        setSamples((prev) => [...prev, vec63]);
        setMsg(`Captured sample #${samples.length + 1}`);
      }
    };
    // dùng capture để đảm bảo bắt trước các handler khác
    window.addEventListener("keydown", onKey, { capture: true });

    return () => {
      window.removeEventListener("keydown", onKey, { capture: true } as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      (videoRef.current?.srcObject as MediaStream | null)
        ?.getTracks()
        .forEach((t) => t.stop());
      recogRef.current?.close();
    };
  }, [isRecording, samples.length]);

  // Start/Stop recording
  async function toggleRecording() {
    if (!isRecording) {
      setSamples([]);
      setIsRecording(true);
      setMsg("Recording… Press Enter to capture samples.");

      // blur nút & phần tử đang focus để Enter không kích hoạt click
      startBtnRef.current?.blur();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // show existing count
      const ds = await loadDatasetFromDisk(side, language);
      setCountOnDisk(ds[label]?.length || 0);
      return;
    }

    setIsRecording(false);
    if (!label.trim() || samples.length === 0) {
      setMsg("Stopped (no samples)");
      return;
    }
    try {
      await saveLabelToDisk(label.trim(), samples, side, language);
      setMsg(
        `Saved ${samples.length} samples → /public/gesture/${language}/${side}/${label}.json (previous on disk: ${countOnDisk})`
      );
      setSamples([]);
    } catch (e: any) {
      setMsg(`Save failed: ${e?.message || "error"}`);
    }
  }

  return (
    <>
      <Header />
      <div className="mx-auto max-w-4xl p-4 sm:p-6 my-6 sm:my-10 space-y-4 sm:space-y-5 text-gray-900">

        {/* Top controls */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 sm:gap-4 lg:gap-6 text-[14px] sm:text-[15px]">
          <label className="flex items-center gap-2 sm:gap-3 font-medium w-full sm:w-auto">
            <span>Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 sm:h-11 w-full sm:w-auto px-3 sm:px-4 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="auslan">Auslan</option>
              <option value="american">American</option>
            </select>
          </label>

          <label className="flex items-center gap-2 sm:gap-3 font-medium w-full sm:w-auto">
            <span>Side:</span>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as "left" | "right")}
              className="h-10 sm:h-11 w-full sm:w-auto px-3 sm:px-4 rounded-xl border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

          <label className="flex items-center gap-2 sm:gap-3 font-medium grow md:grow-0 w-full md:w-auto">
            <span>Label:</span>
            <input
              className="h-10 sm:h-11 w-full sm:w-56 px-3 sm:px-4 rounded-xl border border-gray-300 bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isRecording}
              placeholder="e.g., A, Hello"
            />
          </label>

          <button
            ref={startBtnRef}
            type="button"
            onClick={toggleRecording}
            disabled={!ready}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl font-medium border shadow-sm transition w-full sm:w-auto
              ${isRecording
                ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"}
              ${!ready ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {isRecording ? "Stop" : "Start"}
          </button>
        </div>

        <div className="w-full md:w-auto md:ml-auto mt-2 md:mt-0 flex items-center gap-2 justify-start text-[14px] sm:text-[15px] font-medium">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`} />
            <span className="truncate">{ready ? "Camera: Ready" : "Camera: Loading…"}</span>
        </div>

        {/* Camera card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-md p-3 sm:p-4">
          <div className="relative aspect-video rounded-xl overflow-hidden shadow-sm bg-black">
            <video ref={videoRef} className="hidden" playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          </div>
        </div>

        {/* Hint */}
        <div className="text-[14px] sm:text-[15px] text-gray-800 bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
          <b>Hint:</b> Click <i>Start</i>, make a hand gesture for the label <code className="px-1 rounded bg-gray-100">{label}</code>, then press <kbd className="px-1 rounded bg-gray-100 border border-gray-200">Enter</kbd> to capture. Click <i>Stop</i> to save.
        </div>

        {/* Session status */}
        <div className="text-sm sm:text-[15px] bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
          <div className="mb-1"><b>Status:</b> {msg}</div>
          <div>Current session samples: {samples.length}</div>
        </div>

      </div>
      <Footer />
    </>

  );
}
