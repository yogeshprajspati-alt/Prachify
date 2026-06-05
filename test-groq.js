import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function test() {
  const keys = (process.env.VITE_GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) {
    console.log("No keys found");
    return;
  }
  
  const key = keys[0];
  console.log("Using key:", key.substring(0, 10) + "...");
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10,
    }),
  });
  
  console.log("Status:", res.status);
  const data = await res.text();
  console.log("Response:", data);
}

test();
