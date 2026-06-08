// PulsePoint spike — idempotent ingestion server (zero dependencies).
//
// Two modes, selected per request via ?mode=:
//   naive       — counts EVERY request (mirrors round-one feedback.ts: server makes
//                 the id, so a retried request becomes a second counted event).
//   idempotent  — the client sends a unique key per event; the server counts each
//                 key ONCE and replays the stored response for duplicates.
//
// State is in-memory per tenant. In production the "seen keys" set is a Redis store
// with a TTL, backstopped by a UNIQUE(tenant_id, idempotency_key) DB constraint — the
// mechanism is identical; only the store changes. We keep it in-memory so the spike
// runs with one command and no external services.

import http from 'node:http';

export function createServer() {
  /** tenantId -> { count, seen:Set<key>, deduped } */
  const tenants = new Map();
  const getTenant = (id) => {
    let t = tenants.get(id);
    if (!t) { t = { count: 0, seen: new Set(), deduped: 0 }; tenants.set(id, t); }
    return t;
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    // --- ingest one event ---
    if (req.method === 'POST' && url.pathname === '/events') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let p;
        try { p = JSON.parse(body); } catch { res.writeHead(400); return res.end('{"error":"bad json"}'); }
        const mode = url.searchParams.get('mode') || 'idempotent';
        const t = getTenant(p.tenantId);

        if (mode === 'naive') {
          // No notion of "have I seen this event?" — every request is counted.
          t.count += 1;
          res.writeHead(201, { 'content-type': 'application/json' });
          return res.end('{"counted":true}');
        }

        // idempotent: count once per key, replay response for duplicates.
        if (t.seen.has(p.key)) {
          t.deduped += 1;
          res.writeHead(200, { 'content-type': 'application/json', 'x-idempotent-replay': 'true' });
          return res.end('{"counted":false,"deduped":true}');
        }
        t.seen.add(p.key);
        t.count += 1;
        res.writeHead(201, { 'content-type': 'application/json' });
        return res.end('{"counted":true}');
      });
      return;
    }

    // --- read the authoritative count (what billing would charge) ---
    if (req.method === 'GET' && url.pathname === '/count') {
      const t = getTenant(url.searchParams.get('tenantId'));
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ count: t.count, deduped: t.deduped }));
    }

    res.writeHead(404);
    res.end('{"error":"not found"}');
  });

  return server;
}

// Allow running standalone: `node server.mjs` (the bench starts its own instance).
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8787;
  createServer().listen(port, () => console.log(`idempotent-ingestion server on :${port}`));
}
