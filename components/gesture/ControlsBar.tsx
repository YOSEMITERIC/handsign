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
};

export default function ControlsBar({
  ready, labelInput, setLabelInput, isRecording, onToggleRecording,
  threshold, setThreshold, onExport, onReload, onClear
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
