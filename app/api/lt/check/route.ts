// app/api/lt/check/route.ts
import { NextResponse } from "next/server";

// Tuỳ chọn: set LANGUAGE_TOOL_ENDPOINT qua env để đổi giữa self-host và public
const LT_ENDPOINT = process.env.LANGUAGE_TOOL_ENDPOINT || "https://api.languagetool.org/v2/check";
// Nếu dùng LanguageTool Plus có apiKey thì thêm vào header/body theo yêu cầu của dịch vụ.

export async function POST(req: Request) {
  try {
    const { text, language = "en-US" } = await req.json();

    // Bảo vệ đơn giản
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ matches: [] });
    }

    const params = new URLSearchParams();
    params.set("text", text);
    params.set("language", language);
    // Tuỳ chọn: tone formal/informal; enabledRules/disabledRules v.v.
    // params.set("enabledOnly", "false");

    const resp = await fetch(LT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      // next: { revalidate: 0 } // nếu cần
    });

    if (!resp.ok) {
      const body = await resp.text();
      return NextResponse.json({ error: `LT error: ${resp.status} ${body}`, matches: [] }, { status: 200 });
    }

    const data = await resp.json();
    console.log(data)
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "LT route error", matches: [] }, { status: 200 });
  }
}
