// src/services/whisper.js
// Groq Whisper STT — Fast and accurate

const GROQ_KEYS = (import.meta.env.VITE_GROQ_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

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
  // Adding a prompt heavily biases the AI to spell these artist names correctly 
  // and understand that this is a music context.
  formData.append('prompt', 'Play songs by Arijit Singh, AP Dhillon, Diljit Dosanjh, Shreya Ghoshal, Karan Aujla, Sidhu Moose Wala. Bollywood, Punjabi, Hindi, English, play, pause, next, song, music.');

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

// Wrapper to keep compatibility with existing code
export async function transcribeBest(audioBlob) {
  return await transcribeWithWhisper(audioBlob);
}
