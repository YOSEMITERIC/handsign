// src/lib/speech/speak.ts

export function speakText(
  text: string,
  lang: "american" | "auslan" = "american"
) {
  if (!window.speechSynthesis) return;

  const utter = new SpeechSynthesisUtterance(text.trim());

  // Force giọng Mỹ như yêu cầu
  utter.lang = "en-US";
  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.volume = 1.0;

  speechSynthesis.cancel(); 
  speechSynthesis.speak(utter);
}
