import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { label, samples, side, language } = await req.json();

    if (!label || !Array.isArray(samples) || !side || !language) {
      return NextResponse.json({ ok: false, error: "Invalid params" }, { status: 400 });
    }

    const baseDir = path.join(process.cwd(), "public", "gesture", language, side);
    const filePath = path.join(baseDir, `${label}.json`);

    await fs.mkdir(baseDir, { recursive: true });

    // Merge: append new samples to existing file if any
    let existing: number[][] = [];
    try {
      const raw = await fs.readFile(filePath, "utf8");
      existing = JSON.parse(raw);
      if (!Array.isArray(existing)) existing = [];
    } catch {
      // file not exist → ignore
    }

    const merged = [...existing, ...samples];
    await fs.writeFile(filePath, JSON.stringify(merged, null, 2), "utf8");

    return NextResponse.json({
      ok: true,
      label,
      count: merged.length,
      side,
      language,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Save error" }, { status: 500 });
  }
}
