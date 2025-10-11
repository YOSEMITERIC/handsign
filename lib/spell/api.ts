export const SPELL_BASE = "https://us-east1-serverless-306422.cloudfunctions.net/spellchecker";

export function getLastWordAtCursor(text: string, caret: number) {
  const left = text.slice(0, caret);
  const m = left.match(/([A-Za-z']+)\s*$/);
  return m ? m[1] : "";
}

export function replaceLastWordAtCursor(text: string, caret: number, replacement: string) {
  const left = text.slice(0, caret);
  const right = text.slice(caret);
  const newLeft = left.replace(/([A-Za-z']+)\s*$/, replacement + " ");
  const newCaret = newLeft.length;
  return { text: newLeft + right, caret: newCaret };
}

export type SpellResult = { misspelled: boolean; suggestions: string[] };

export async function checkWord(word: string): Promise<SpellResult> {
  if (!word) return { misspelled: false, suggestions: [] };
  const missRes = await fetch(`${SPELL_BASE}/misspelled?word=${encodeURIComponent(word)}`);
  const missData = await missRes.json();
  if (!missData?.misspelled) return { misspelled: false, suggestions: [] };
  const corrRes = await fetch(`${SPELL_BASE}/corrections?word=${encodeURIComponent(word)}`);
  const corrData = await corrRes.json();
  return { misspelled: true, suggestions: (corrData?.corrections || []).slice(0, 5) };
}
