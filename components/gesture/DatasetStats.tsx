import React from "react";

type Props = {
  dataset: Record<string, number[][]>;
};

export default function DatasetStats({ dataset }: Props) {
  const totalSamples = Object.values(dataset).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="text-xs bg-gray-50 border rounded p-2">
      <div>
        <b>Dataset stats:</b> {Object.keys(dataset).length} labels, {totalSamples} samples
      </div>
      <ul className="list-disc ml-5">
        {Object.entries(dataset).map(([lab, arr]) => (
          <li key={lab}>
            {lab}: {arr.length} samples
          </li>
        ))}
      </ul>
    </div>
  );
}
