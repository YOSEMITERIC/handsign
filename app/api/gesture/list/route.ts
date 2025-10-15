import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const side = (searchParams.get("side") || "left") as "left" | "right";
    const language = searchParams.get("language") || "auslan";

    const baseDir = path.join(process.cwd(), "public", "gesture", language, side);

    let dataset: Record<string, number[][]> = {};
    let files: string[] = [];
    try {
      files = await fs.readdir(baseDir);
    } catch {
      // folder chưa có → trả rỗng
      return NextResponse.json({ ok: true, dataset: {} });
    }

    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const label = f.replace(/\.json$/, "");
      try {
        const raw = await fs.readFile(path.join(baseDir, f), "utf8");
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) dataset[label] = arr;
      } catch {
        // skip broken files
      }
    }

    return NextResponse.json({ ok: true, dataset, side, language });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "List error" }, { status: 500 });
  }
}
