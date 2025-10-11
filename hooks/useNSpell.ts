import { useEffect, useMemo, useState } from "react";
import nspell, { NSpell } from "nspell";

export function useNSpell(affUrl = "/dict/en_US.aff", dicUrl = "/dict/en_US.dic") {
  const [spell, setSpell] = useState<NSpell | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = !!spell;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [affRes, dicRes] = await Promise.all([fetch(affUrl), fetch(dicUrl)]);
        if (!affRes.ok || !dicRes.ok) throw new Error("Cannot load .aff/.dic");
        const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
        if (!cancelled) setSpell(nspell(aff, dic));
      } catch (e:any) {
        if (!cancelled) setError(e?.message || "nspell init error");
      }
    })();
    return () => { cancelled = true; };
  }, [affUrl, dicUrl]);

  const api = useMemo(() => {
    if (!spell) {
      return {
        isReady: false,
        correctWord: (w:string)=>w,
        isCorrect: (_w:string)=>false,
        suggest: (_w:string,_k=5)=>[] as string[],
        addWord: (_w:string)=>{}
      };
    }
    return {
      isReady: true,
      correctWord: (w:string) => {
        const t = w.toLowerCase().replace(/[^a-z']/g,"");
        if (!t) return w;
        if (spell.correct(t)) return w;
        const s = spell.suggest(t);
        return s[0] ?? w;
      },
      isCorrect: (w:string)=> spell.correct(w.toLowerCase()),
      suggest: (w:string,k=5)=> spell.suggest(w.toLowerCase()).slice(0,k),
      addWord: (w:string)=> spell.add(w)
    };
  }, [spell]);

  return { ready, error, ...api };
}
