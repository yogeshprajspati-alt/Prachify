/**
 * Cloudflare Worker for Prachify Telemetry
 * Captures errors, latency spikes, and taste drift events.
 * 
 * Schema:
 * CREATE TABLE events (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   type TEXT NOT NULL,
 *   payload TEXT NOT NULL,
 *   timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
 * );
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'POST' && new URL(request.url).pathname === '/api/events') {
      try {
        const body = await request.json();
        
        // Basic validation
        if (!body.type || !body.payload) {
          return new Response('Missing type or payload', { status: 400 });
        }

        // Insert into D1
        const stmt = env.DB.prepare(
          'INSERT INTO events (type, payload) VALUES (?, ?)'
        ).bind(body.type, JSON.stringify(body.payload));
        
        await stmt.run();

        return new Response('OK', {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(`Error: ${err.message}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
