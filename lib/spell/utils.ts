export function getLastSentenceRange(text: string) {
  // Tìm dấu kết câu cuối cùng
  const end = text.length;
  // Bỏ space cuối nếu có
  const trimmedEnd = text.replace(/\s+$/,'').length;
  const punctIdx = Math.max(
    text.lastIndexOf(".", trimmedEnd - 1),
    text.lastIndexOf("?", trimmedEnd - 1),
    text.lastIndexOf("!", trimmedEnd - 1)
  );
  const start = punctIdx >= 0 ? punctIdx + 1 : 0;
  // Bỏ space đầu câu
  const leading = text.slice(start, trimmedEnd).match(/^\s+/)?.[0]?.length ?? 0;
  const s = start + leading;
  const sentence = text.slice(s, trimmedEnd);
  return { start: s, end: trimmedEnd, sentence };
}

type Replacement = { offset: number; length: number; replacement: string };
export function applyReplacementsDesc(base: string, startOffset: number, reps: Replacement[]) {
  // reps.offset là tính từ đầu của câu; cần cộng startOffset vào để áp vào toàn chuỗi
  const sorted = [...reps].sort((a,b)=> b.offset - a.offset);
  let out = base;
  for (const r of sorted) {
    const absStart = startOffset + r.offset;
    const absEnd = absStart + r.length;
    out = out.slice(0, absStart) + r.replacement + out.slice(absEnd);
  }
  return out;
}
