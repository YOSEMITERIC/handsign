// Client helpers call Next.js API routes

export async function saveLabelToDisk(
  label: string,
  samples: number[][],
  side: "left" | "right",
  language: string
) {
  const res = await fetch("/api/gesture/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, samples, side, language }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Save failed");
  return data as { ok: true; label: string; count: number; side: string; language: string };
}

export async function loadDatasetFromDisk(
  side: "left" | "right",
  language: string
): Promise<Record<string, number[][]>> {
  const params = new URLSearchParams({ side, language });
  const res = await fetch(`/api/gesture/list?${params.toString()}`);
  const data = await res.json();
  if (data.ok) return (data.dataset || {}) as Record<string, number[][]>;
  return {};
}
