import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type SaveBody = {
  label: string;
  samples: number[][]; // mỗi sample là vec63 đã chuẩn hoá & mirror
};

export async function POST(req: Request) {
  try {
    const body: SaveBody = await req.json();
    const label = (body.label || "").trim();
    if (!label) {
      return NextResponse.json({ ok: false, error: "Missing label" }, { status: 400 });
    }
    const samples = Array.isArray(body.samples) ? body.samples : [];
    if (samples.length === 0) {
      return NextResponse.json({ ok: false, error: "No samples" }, { status: 400 });
    }

    const folder = path.join(process.cwd(), "public", "gesture");
    await mkdir(folder, { recursive: true });

    const filePath = path.join(folder, `${label}.json`);

    // Nếu file đã có thì merge thêm (append-merge)
    let existing: number[][] = [];
    try {
      const buf = await readFile(filePath, "utf8");
      const parsed = JSON.parse(buf);
      if (Array.isArray(parsed)) existing = parsed;
    } catch (_) {
      // file chưa tồn tại: bỏ qua
    }

    const merged = [...existing, ...samples];
    await writeFile(filePath, JSON.stringify(merged, null, 2), "utf8");

    return NextResponse.json({ ok: true, label, count: merged.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}
