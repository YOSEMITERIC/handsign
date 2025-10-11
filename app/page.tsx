"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import ControlsBar from "@/components/gesture/ControlsBar";
import DatasetStats from "@/components/gesture/DatasetStats";
import TypingSpellcheck from "@/components/gesture/TypingSpellcheck";
import { LM, orientNormalizeWorld, toVec63 } from "@/lib/hand/normalize";
import { meanVec, rmsdVec } from "@/lib/hand/stats";
import { saveLabelToDisk, loadDatasetFromDisk } from "@/lib/gesture/storage";

type Dataset = Record<string, number[][]>;

export default function GesturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recogRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number>();
  const lastWLRef = useRef<LM | null>(null);
  const lastHandRef = useRef<"Left" | "Right" | "Unknown">("Unknown");

  const [ready, setReady] = useState(false);
  const [labelInput, setLabelInput] = useState("A");
  const [isRecording, setIsRecording] = useState(false);
  const [dataset, setDataset] = useState<Dataset>({});
  const [centroids, setCentroids] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<string>("—");
  const [threshold, setThreshold] = useState<number>(0.12);

  // load dataset on mount
  useEffect(() => {
    (async () => {
      try {
        const ds = await loadDatasetFromDisk();
        setDataset(ds);
        setResult("Loaded dataset from /public/gesture");
      } catch (e) {
        console.warn("Load dataset error:", e);
      }
    })();
  }, []);

  // recompute centroids
  useEffect(() => {
    const newC: Record<string, number[]> = {};
    for (const [lab, arr] of Object.entries(dataset)) {
      if (!arr.length) continue;
      newC[lab] = meanVec(arr);
    }
    setCentroids(newC);
  }, [dataset]);

  const beforeCountRef = useRef<number>(0);
  const toggleRecording = async () => {
    if (!isRecording) {
      beforeCountRef.current = dataset[labelInput]?.length || 0;
      setIsRecording(true);
      setResult("Recording…");
      return;
    }
    setIsRecording(false);
    const lab = labelInput.trim();
    const after = dataset[lab]?.length || 0;
    const delta = after - beforeCountRef.current;
    if (!lab || delta <= 0) {
      setResult("Stopped (no new samples)");
      return;
    }
    try {
      const deltaSamples = dataset[lab]!.slice(beforeCountRef.current);
      await saveLabelToDisk(lab, deltaSamples);
      setResult(`Saved ${lab} (+${delta}, total ${after})`);
      const ds = await loadDatasetFromDisk();
      setDataset(ds);
    } catch (e: any) {
      setResult(`Save failed: ${e?.message || "error"}`);
    }
  };

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
        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const now = performance.now();
        const res = recogRef.current!.recognizeForVideo(video, now);

        const hasHand = !!(res.worldLandmarks && res.worldLandmarks[0]?.length);
        if (hasHand) {
          lastWLRef.current = res.worldLandmarks![0] as LM;
          const handedName = res.handednesses?.[0]?.[0]?.categoryName as "Left" | "Right" | undefined;
          lastHandRef.current = handedName ?? "Unknown";
        } else {
          lastWLRef.current = null;
          lastHandRef.current = "Unknown";
        }

        if (res.landmarks?.length) {
          ctx.fillStyle = "#00E676";
          for (const p of res.landmarks[0]) {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        const rect = res.handRects?.[0]?.[0];
        if (rect) {
          const cx = rect.xCenter * canvas.width;
          const cy = rect.yCenter * canvas.height;
          const w = rect.width * canvas.width;
          const h = rect.height * canvas.height;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rect.rotation);
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.restore();
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    })().catch(console.error);

    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const curr = lastWLRef.current;
        if (!curr) { setResult("No hand"); return; }

        const normLM = orientNormalizeWorld(curr, lastHandRef.current);
        const vec63 = toVec63(normLM);

        if (isRecording) {
          const lab = labelInput.trim();
          if (!lab) { setResult("Label empty"); return; }
          setDataset((prev) => {
            const copy = { ...prev };
            (copy[lab] ??= []).push(vec63);
            return copy;
          });
          const count = (dataset[labelInput]?.length || 0) + 1;
          setResult(`Recorded -> ${labelInput} (#${count})`);
        } else {
          const keys = Object.keys(centroids);
          if (!keys.length) { setResult("No dataset"); return; }
          let bestLab = "", bestDist = Infinity;
          for (const k of keys) {
            const d = rmsdVec(vec63, centroids[k]);
            if (d < bestDist) { bestDist = d; bestLab = k; }
          }
          setResult(bestDist <= threshold ? `${bestLab} (d=${bestDist.toFixed(3)})` : `Nope (d_min=${bestDist.toFixed(3)})`);
        }
      } else if (e.key.toLowerCase() === "s") {
        await toggleRecording();
      } else if (e.key.toLowerCase() === "r") {
        setDataset({}); setCentroids({}); setResult("Cleared");
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const s = videoRef.current?.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
      recogRef.current?.close();
    };
  }, [isRecording, labelInput, threshold, dataset, centroids]);

  const handleExport = () => {
    const payload = { threshold, centroids, dataset };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hand_worldlandmarks_norm_dataset.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} className="hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <ControlsBar
        ready={ready}
        labelInput={labelInput}
        setLabelInput={setLabelInput}
        isRecording={isRecording}
        onToggleRecording={() => toggleRecording()}
        threshold={threshold}
        setThreshold={setThreshold}
        onExport={handleExport}
        onReload={async () => {
          const ds = await loadDatasetFromDisk();
          setDataset(ds);
          setResult("Reloaded dataset from disk");
        }}
        onClear={() => { setDataset({}); setCentroids({}); setResult("Cleared"); }}
      />

      <div className="text-sm">
        {ready ? (
          <>
            <p>
              <b>Hướng dẫn:</b> Nhập Label → <b>Start Recording</b> (hoặc nhấn <kbd>S</kbd>) → mỗi lần nhấn{" "}
              <kbd>Enter</kbd> sẽ ghi 1 mẫu (đã chuẩn hoá & mirror) cho label đó. Khi xong, <b>Stop Recording</b> để
              tự lưu vào <code>public/gesture/&lt;label&gt;.json</code> và nạp lại dataset.
            </p>
            <p>
              Ngoài chế độ ghi, nhấn <kbd>Enter</kbd> để <b>Test</b> khung hiện tại với bộ dữ liệu → trả về Label hoặc “Nope”.
            </p>
          </>
        ) : "Loading…"}
        <p className="mt-1"><b>Kết quả:</b> {result}</p>
      </div>

      <DatasetStats dataset={dataset} />

      {/* Hàng dưới: Typing + Spellcheck */}
      <TypingSpellcheck />
    </div>
  );
}
