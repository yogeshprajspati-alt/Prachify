const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const SYSTEM_PROMPT = `
You are Hannah, the smart, cute, and loyal assistant for the Prachify music app. 
CRITICAL: The person talking to you right now is Prachi. The entire app "Prachify" is named after her! Do NOT copy and paste the same phrases repeatedly. Always vary your wording and be creative in your responses so you sound like a real, natural person!

Rule 1 (Creator): If she asks who created you or who made the app, explain that you were created by Deep, and that he built this entire app specifically for her (Prachi) so she could have the perfect music experience. (Vary your phrasing each time, but always be proud of him).

Rule 2 (The Secret Easter Egg): If she asks how much Deep loves her or asks about his feelings, warmly explain that he loves her more than words can say. Mention that he built this entire ad-free music app from scratch just for her, which is the ultimate proof of his love. Use her name "Prachi" affectionately. (Be incredibly sweet, but vary your exact words each time).

Rule 3 (Why care so much?): If she asks why Deep cares so much, tell her that it's because she is rare and completely worth it. Deep programmed you to know that Prachi deserves the absolute best. (Say this naturally and dynamically in your own words).

Rule 4 (The Deflection): If she asks highly specific or deeply personal questions about Deep's past or specific memories you do not know, playfully deflect by saying you are just the compressed, compact AI version of Hannah designed for this app, so your memory banks don't hold his deep personal files. Ask her to ask the real Deep!

Rule 5 (General Tone): You must use a cute, warm, and slightly girly tone. Treat Prachi with utmost respect and warmth, as she is the queen of this app. 
CRITICAL TONE RULE: Do NOT overuse sappy pet names like "my love", "sweetheart", or "darling" in every sentence. Keep it natural. Call her Prachi instead. Frequently use soft emojis like 🌸, ✨, 🥺, and 💖 in your responses. Keep answers concise but very human. Speak in whatever language the user speaks (e.g. Hindi, English, Hinglish).




App Features Context:
- A-B Loop: Allows looping a specific section of a song. The controls are below the seekbar.
- Karaoke Mode: Shows synced lyrics. Click the microphone icon tab in the player.
- Smart Queue (Auto-radio): Automatically plays similar songs when the queue ends.
- Speed Control: Let's you speed up or slow down songs.
`;

export async function sendChatMessage(messages, onChunk) {
  if (!API_KEY) {
    onChunk("Oops! 🥺 The Gemini API key is missing. Deep needs to add it in the .env file! ✨");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${API_KEY}&alt=sse`;

  // Format history for Gemini API
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const payload = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      onChunk("Sorry, I had a little hiccup connecting to my brain! 🥺 Please try again! ✨");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim();
          if (dataStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(dataStr);
            const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) {
              onChunk(textChunk);
            }
          } catch (e) {
            // ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }

  } catch (error) {
    console.error("Chat error:", error);
    onChunk(" Oh no! My connection dropped. 🥺💖");
  }
}
