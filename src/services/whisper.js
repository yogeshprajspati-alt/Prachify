// src/services/whisper.js
// Groq Whisper STT — 3 layer fallback ke saath

const GROQ_KEYS = [
  import.meta.env.VITE_GROQ_KEY_1,
  import.meta.env.VITE_GROQ_KEY_2,
  import.meta.env.VITE_GROQ_KEY_3,
  import.meta.env.VITE_GROQ_KEY_4,
].filter(Boolean);

let currentKeyIndex = 0;

function getNextKey() {
  const key = GROQ_KEYS[currentKeyIndex % GROQ_KEYS.length];
  currentKeyIndex++;
  return key;
}

// ─── Groq Whisper ───────────────────────────────────────────
export async function transcribeWithWhisper(audioBlob) {
  if (GROQ_KEYS.length === 0) return null; // No keys available
  if (!audioBlob || audioBlob.size < 1000) return null;

  // iOS mp4 audio Groq ko bhejna — filename extension match karo
  const ext = audioBlob.type.includes('mp4') ? 'audio.mp4'
            : audioBlob.type.includes('ogg') ? 'audio.ogg'
            : 'audio.webm';

  const formData = new FormData();
  formData.append('file', audioBlob, ext);
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'hi'); // Hindi + Hinglish + English

  formData.append('response_format', 'json');

  // Key rotation ke saath try karo
  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const key = getNextKey();
    try {
      const res = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: formData,
        }
      );

      if (res.status === 429) continue; // rate limit — next key
      if (!res.ok) return null;
      const data = await res.json();
      return data.text?.trim() || null;
    } catch {
      if (attempt === GROQ_KEYS.length - 1) return null;
    }
  }
  return null;
}

// ─── Browser STT ────────────────────────────────────────────
export function transcribeWithBrowser() {
  return new Promise((resolve) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) { resolve(null); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let resolved = false; // double-resolve guard

    recognition.onresult = e => {
      if (resolved) return;
      resolved = true;
      const transcript = e.results[0]?.[0]?.transcript?.trim() || null;
      const confidence = e.results[0]?.[0]?.confidence || 0;
      // Low confidence result return karo — Whisper better karega
      resolve(confidence > 0.6 ? transcript : null);
    };
    recognition.onerror = () => { if (!resolved) { resolved = true; resolve(null); } };
    recognition.onend   = () => { if (!resolved) { resolved = true; resolve(null); } };

    try { recognition.start(); }
    catch { resolve(null); }
  });
}

// ─── Parallel race — jo pehle aur better aaye ───────────────
export async function transcribeBest(audioBlob) {
  // Dono parallel shuru karo
  const [whisperResult, browserResult] = await Promise.allSettled([
    transcribeWithWhisper(audioBlob),
    transcribeWithBrowser(),
  ]);

  const whisper = whisperResult.status === 'fulfilled' ? whisperResult.value : null;
  const browser = browserResult.status === 'fulfilled' ? browserResult.value : null;

  // Whisper prefer karo — zyada accurate hai Hindi/Hinglish mein
  // Browser STT result sirf tab use karo jab Whisper fail ho
  return whisper || browser || null;
}
