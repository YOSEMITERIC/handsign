"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { LM, orientNormalizeWorld, toVec63 } from "@/lib/hand/normalize";
import { saveLabelToDisk, loadDatasetFromDisk } from "@/lib/gesture/storage";

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
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span>Language:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="auslan">Auslan</option>
            <option value="american">American</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>Side:</span>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "left" | "right")}
            className="border rounded px-2 py-1"
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>Label:</span>
          <input
            className="border rounded px-2 py-1 w-40"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={isRecording}
          />
        </div>

        <button
          ref={startBtnRef}
          type="button"
          onClick={toggleRecording}
          disabled={!ready}
          className={`px-3 py-1 rounded border ${
            isRecording ? "bg-red-600 text-white" : ""
          }`}
        >
          {isRecording ? "Stop" : "Start"}
        </button>

        <span className="ml-auto text-xs">
          {ready ? "Camera: Ready" : "Camera: Loading…"}
        </span>
      </div>

      <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow">
        <video ref={videoRef} className="hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="text-sm">
        <b>Hint:</b> Click <i>Start</i>, đưa tay tạo hình cho nhãn{" "}
        <code>{label}</code>, bấm <kbd>Enter</kbd> để chụp. Bấm <i>Stop</i> để
        lưu.
      </div>

      <div className="text-xs bg-gray-50 border rounded p-2">
        <div>
          <b>Status:</b> {msg}
        </div>
        <div>Current session samples: {samples.length}</div>
      </div>
    </div>
  );
}
