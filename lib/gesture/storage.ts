export async function saveLabelToDisk(label: string, samples: number[][]) {
  const res = await fetch("/api/gesture/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, samples }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Save failed");
  return data as { ok: true; label: string; count: number };
}

export async function loadDatasetFromDisk(): Promise<Record<string, number[][]>> {
  const res = await fetch("/api/gesture/list");
  const data = await res.json();
  if (data.ok) return (data.dataset || {}) as Record<string, number[][]>;
  return {};
}
