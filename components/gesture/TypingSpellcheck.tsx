import React, { useRef, useState } from "react";
import { checkWord, getLastWordAtCursor, replaceLastWordAtCursor } from "@/lib/spell/api";

export default function TypingSpellcheck() {
  const [typed, setTyped] = useState<string>("");
  const [cursor, setCursor] = useState<number>(0);
  const [spellLoading, setSpellLoading] = useState(false);
  const [spellError, setSpellError] = useState<string|null>(null);
  const [lastCheckedWord, setLastCheckedWord] = useState<string>("");
  const [spellSuggestions, setSpellSuggestions] = useState<string[]>([]);
  const cacheRef = useRef<Map<string, { misspelled: boolean; suggestions: string[] }>>(new Map());

  async function checkWordRemote(word: string) {
    if (!word) return;
    const key = word.toLowerCase();
    if (cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key)!;
      setLastCheckedWord(word);
      setSpellSuggestions(cached.misspelled ? cached.suggestions : []);
      return;
    }
    try {
      setSpellLoading(true);
      setSpellError(null);
      const res = await checkWord(word);
      cacheRef.current.set(key, res);
      setLastCheckedWord(word);
      setSpellSuggestions(res.misspelled ? res.suggestions : []);
      setSpellLoading(false);
    } catch (e:any) {
      setSpellLoading(false);
      setSpellError(e?.message || "Spell API error");
    }
  }

  function applySuggestionToTyped(s: string) {
    const { text, caret } = replaceLastWordAtCursor(typed, cursor, s);
    setTyped(text);
    setCursor(caret);
    setSpellSuggestions([]);
    setLastCheckedWord(s);
  }

  function onTypedChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setTyped(e.target.value);
    setCursor(e.target.selectionStart ?? e.target.value.length);
  }

  async function onTypedKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === " ") {
      const caret = (e.currentTarget.selectionStart ?? typed.length);
      const word = getLastWordAtCursor(typed, caret);
      if (word) await checkWordRemote(word);
    }
    if (e.key >= "1" && e.key <= "5" && spellSuggestions.length) {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      if (spellSuggestions[idx]) applySuggestionToTyped(spellSuggestions[idx]);
    }
  }

  return (
    <div className="border rounded p-3">
      <div className="text-sm font-semibold mb-2">Typing (spellcheck on space)</div>
      <textarea
        className="w-full h-28 border rounded px-2 py-2 text-sm"
        placeholder="Type here... e.g., Apple iss"
        value={typed}
        onChange={onTypedChange}
        onKeyDown={onTypedKeyDown}
        onClick={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? typed.length)}
        onKeyUp={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? typed.length)}
      />
      <div className="mt-2 text-sm flex items-center gap-2">
        <b>Spellcheck:</b>
        {spellLoading ? <span>checking…</span> : lastCheckedWord ? <span>last: <i>{lastCheckedWord}</i></span> : <span>—</span>}
        {spellError && <span className="text-red-500">• {spellError}</span>}
      </div>
      {spellSuggestions.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-gray-600 mb-1">Suggestions (press 1–5 to pick):</div>
          <div className="flex flex-wrap gap-2">
            {spellSuggestions.map((s, i) => (
              <button
                key={s}
                onClick={() => applySuggestionToTyped(s)}
                className={`px-2 py-1 border rounded ${i===0 ? "bg-black text-white" : "hover:bg-gray-50"}`}
                title={i===0 ? "Top suggestion" : ""}
              >
                {i+1}. {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
