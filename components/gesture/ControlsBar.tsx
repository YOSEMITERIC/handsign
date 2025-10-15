import React from "react";

type Props = {
  ready: boolean;
  labelInput: string;
  setLabelInput: (v: string) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  threshold: number;
  setThreshold: (v: number) => void;
  onExport: () => void;
  onReload: () => void;
  onClear: () => void;
  // NEW
  side: "left" | "right";
  setSide: (v: "left" | "right") => void;
  language: string;
  setLanguage: (v: string) => void;
  languages?: string[]; // optional: để đổ dropdown
};

export default function ControlsBar({
  ready, labelInput, setLabelInput, isRecording, onToggleRecording,
  threshold, setThreshold, onExport, onReload, onClear,
  side, setSide, language, setLanguage, languages = ["auslan", "american"]
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span>Label:</span>
        <input
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="A"
          disabled={isRecording}
        />
      </div>

      <div className="flex items-center gap-2">
        <span>Language:</span>
        <select
          className="border rounded px-2 py-1"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={isRecording}
        >
          {languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span>Side:</span>
        <select
          className="border rounded px-2 py-1"
          value={side}
          onChange={(e) => setSide(e.target.value as "left" | "right")}
          disabled={isRecording}
        >
          <option value="left">left</option>
          <option value="right">right</option>
        </select>
      </div>

      <button
        onClick={onToggleRecording}
        className={`px-3 py-1 rounded border ${isRecording ? "bg-red-600 text-white" : ""}`}
        disabled={!ready}
        title="(Phím S)"
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      <div className="flex items-center gap-2">
        <span>Threshold:</span>
        <input
          type="number"
          step="0.01"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="border rounded px-2 py-1 w-20"
          title="Thử 0.08–0.15 khi đã căn hướng"
        />
      </div>

      <button onClick={onExport} className="px-3 py-1 rounded border" title="Export JSON dataset">
        Export JSON
      </button>

      <button onClick={onReload} className="px-3 py-1 rounded border" title="Reload from /public/gesture">
        Reload Dataset
      </button>

      <button onClick={onClear} className="px-3 py-1 rounded border" title="(Phím R)">
        Clear
      </button>
    </div>
  );
}
