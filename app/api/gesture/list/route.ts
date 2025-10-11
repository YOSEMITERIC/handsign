import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const folder = path.join(process.cwd(), "public", "gesture");
    let dataset: Record<string, number[][]> = {};
    let files: string[] = [];
    try {
      files = await readdir(folder);
    } catch (_) {
      // folder chưa có -> trả rỗng
      return NextResponse.json({ ok: true, dataset: {} });
    }

    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const label = f.replace(/\.json$/i, "");
      try {
        const buf = await readFile(path.join(folder, f), "utf8");
        const arr = JSON.parse(buf);
        if (Array.isArray(arr)) dataset[label] = arr;
      } catch (_) {
        // bỏ qua file lỗi
      }
    }

    return NextResponse.json({ ok: true, dataset });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}
