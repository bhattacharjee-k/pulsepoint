// PulsePoint spike — load test for idempotent ingestion (zero dependencies).
//
// Run:  node bench.mjs
//
// Produces: console summary, results.json, and report.html (with SVG graphs).
//
// Three experiments:
//   1. Headline retry storm — fire U unique events, each retried R times, both modes.
//      Proves: idempotent count == U (exact); naive count == U*R (wrong invoice).
//   2. Correctness sweep — vary the retry multiplier 1..N; chart counted-vs-truth.
//      The "graceful vs cliff" graph: idempotent stays flat on truth, naive diverges.
//   3. Load sweep — push concurrency up; chart throughput + p95 latency (the knee).

import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createServer } from './server.mjs';

const agent = new http.Agent({ keepAlive: true, maxSockets: 1024 });
let PORT = 0;

function request(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request(
      { host: '127.0.0.1', port: PORT, method, path, agent,
        headers: data ? { 'content-type': 'application/json', 'content-length': data.length } : {} },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b })); }
    );
    r.on('error', () => resolve({ status: 0, body: '' }));
    if (data) r.write(data);
    r.end();
  });
}

// Concurrency-limited runner. tasks = array of () => Promise<{status}>.
async function runPool(tasks, concurrency) {
  let i = 0;
  const lat = new Float64Array(tasks.length);
  let errors = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      const t0 = performance.now();
      const r = await tasks[idx]();
      lat[idx] = performance.now() - t0;
      if (!r.status || r.status >= 500) errors++;
    }
  }
  const t0 = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const wallMs = performance.now() - t0;
  return { lat, wallMs, errors, throughput: (tasks.length / wallMs) * 1000 };
}

function percentile(latArr, p) {
  const a = Array.from(latArr).sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Build a storm: U unique events, each duplicated R times, shuffled so retries interleave.
function stormTasks(tenantId, U, R, mode) {
  const tasks = [];
  for (let u = 0; u < U; u++) for (let r = 0; r < R; r++) {
    const key = `e${u}`;
    tasks.push(() => request('POST', `/events?mode=${mode}`, { tenantId, key, type: 'click' }));
  }
  return shuffle(tasks);
}

async function getCount(tenantId) {
  const r = await request('GET', `/count?tenantId=${encodeURIComponent(tenantId)}`);
  return JSON.parse(r.body);
}

async function main() {
  const server = createServer();
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  PORT = server.address().port;
  console.log(`\n  PulsePoint · idempotent ingestion spike — server on :${PORT}\n`);

  // warmup
  await runPool(stormTasks('warmup', 200, 2, 'idempotent'), 50);

  const results = { generatedAt: new Date().toISOString(), node: process.version };

  // ---------- Experiment 1: headline retry storm ----------
  const U = Number(process.env.U) || 10000;   // unique events
  const R = Number(process.env.R) || 3;        // each retried R times
  const C = Number(process.env.C) || 100;      // concurrency

  console.log(`  [1] Headline storm: ${U} unique events, each sent ${R}x = ${U * R} requests @ concurrency ${C}\n`);

  const idem = await runPool(stormTasks('head-idem', U, R, 'idempotent'), C);
  const idemCount = await getCount('head-idem');
  const naive = await runPool(stormTasks('head-naive', U, R, 'naive'), C);
  const naiveCount = await getCount('head-naive');

  results.headline = {
    uniqueEvents: U, retryMultiplier: R, totalRequests: U * R, concurrency: C,
    idempotent: {
      billedCount: idemCount.count, deduped: idemCount.deduped,
      exact: idemCount.count === U,
      throughput: Math.round(idem.throughput),
      p50: +percentile(idem.lat, 50).toFixed(2), p95: +percentile(idem.lat, 95).toFixed(2), p99: +percentile(idem.lat, 99).toFixed(2),
    },
    naive: {
      billedCount: naiveCount.count, exact: naiveCount.count === U,
      overcountFactor: +(naiveCount.count / U).toFixed(2),
      throughput: Math.round(naive.throughput),
      p50: +percentile(naive.lat, 50).toFixed(2), p95: +percentile(naive.lat, 95).toFixed(2), p99: +percentile(naive.lat, 99).toFixed(2),
    },
  };

  const h = results.headline;
  console.log(`      idempotent → billed ${h.idempotent.billedCount.toLocaleString()} (truth ${U.toLocaleString()}) ${h.idempotent.exact ? '✅ EXACT' : '❌'}  | ${h.idempotent.deduped.toLocaleString()} retries absorbed | ${h.idempotent.throughput.toLocaleString()} req/s | p95 ${h.idempotent.p95}ms`);
  console.log(`      naive      → billed ${h.naive.billedCount.toLocaleString()} (truth ${U.toLocaleString()}) ${h.naive.exact ? '✅' : '❌ OVER by ' + h.naive.overcountFactor + 'x → wrong invoice'} | ${h.naive.throughput.toLocaleString()} req/s | p95 ${h.naive.p95}ms\n`);

  // ---------- Experiment 2: correctness sweep (retry multiplier 1..8) ----------
  console.log('  [2] Correctness sweep: retry multiplier 1..8 ...');
  const sweepU = 2000;
  const sweep = [];
  for (let r = 1; r <= 8; r++) {
    await runPool(stormTasks(`sw-i-${r}`, sweepU, r, 'idempotent'), 100);
    const ic = await getCount(`sw-i-${r}`);
    await runPool(stormTasks(`sw-n-${r}`, sweepU, r, 'naive'), 100);
    const nc = await getCount(`sw-n-${r}`);
    sweep.push({ retry: r, truth: sweepU, idempotent: ic.count, naive: nc.count });
  }
  results.correctnessSweep = { uniqueEvents: sweepU, points: sweep };
  console.log(`      done (${sweep.length} points)\n`);

  // ---------- Experiment 3: load sweep (find the knee) ----------
  console.log('  [3] Load sweep: concurrency 25 → 800 ...');
  const loadN = Number(process.env.LOAD_N) || 12000;
  const levels = [25, 50, 100, 200, 400, 800];
  const load = [];
  for (const c of levels) {
    const run = await runPool(stormTasks(`load-${c}`, loadN, 1, 'idempotent'), c);
    load.push({ concurrency: c, throughput: Math.round(run.throughput),
      p50: +percentile(run.lat, 50).toFixed(2), p95: +percentile(run.lat, 95).toFixed(2), p99: +percentile(run.lat, 99).toFixed(2) });
  }
  results.loadSweep = { requestsPerLevel: loadN, points: load };
  console.log('      ' + load.map((l) => `c${l.concurrency}:${l.throughput}rps/p95 ${l.p95}ms`).join('  ') + '\n');

  server.close();

  writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results, null, 2));
  writeFileSync(new URL('./report.html', import.meta.url), renderReport(results));
  console.log('  Wrote results.json and report.html');
  console.log('  Open report.html in a browser to see the graphs.\n');

  // The benchmark doubles as a test: fail loudly if billing is not exact.
  if (!results.headline.idempotent.exact) { console.error('  ❌ FAIL: idempotent count was not exact'); process.exit(1); }
  process.exit(0);
}

// ---------------- SVG charting (hand-rolled, no deps) ----------------
function lineChart({ title, xlabel, ylabel, xticks, series, yMax, width = 640, height = 340 }) {
  const pad = { l: 64, r: 20, t: 40, b: 48 };
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const xMin = xticks[0], xMax = xticks[xticks.length - 1];
  const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * iw;
  const sy = (y) => pad.t + ih - (y / (yMax || 1)) * ih;
  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Segoe UI,Roboto,sans-serif">`;
  svg += `<text x="${width / 2}" y="22" text-anchor="middle" font-size="15" font-weight="700" fill="#1f2937">${title}</text>`;
  // y gridlines
  for (let g = 0; g <= 4; g++) {
    const yv = (yMax / 4) * g, y = sy(yv);
    svg += `<line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#eef2f7"/>`;
    svg += `<text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${fmt(yv)}</text>`;
  }
  // x ticks
  for (const xt of xticks) svg += `<text x="${sx(xt)}" y="${height - pad.b + 18}" text-anchor="middle" font-size="11" fill="#6b7280">${xt}</text>`;
  // axes labels
  svg += `<text x="${pad.l + iw / 2}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#6b7280">${xlabel}</text>`;
  svg += `<text transform="translate(16,${pad.t + ih / 2}) rotate(-90)" text-anchor="middle" font-size="11" fill="#6b7280">${ylabel}</text>`;
  // series
  for (const s of series) {
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ');
    svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5"${s.dashed ? ' stroke-dasharray="6 5"' : ''}/>`;
    for (const p of s.points) svg += `<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="3" fill="${s.color}"/>`;
  }
  // legend
  let lx = pad.l + 6;
  for (const s of series) { svg += `<rect x="${lx}" y="${pad.t - 2}" width="11" height="11" rx="2" fill="${s.color}"/><text x="${lx + 16}" y="${pad.t + 8}" font-size="11" fill="#1f2937">${s.name}</text>`; lx += 28 + s.name.length * 7; }
  return svg + '</svg>';
}

function barChart({ title, bars, ylabel, yMax, width = 640, height = 300 }) {
  const pad = { l: 64, r: 20, t: 40, b: 48 };
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const bw = (iw / bars.length) * 0.6, gap = (iw / bars.length) * 0.4;
  const sy = (y) => pad.t + ih - (y / (yMax || 1)) * ih;
  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Segoe UI,Roboto,sans-serif">`;
  svg += `<text x="${width / 2}" y="22" text-anchor="middle" font-size="15" font-weight="700" fill="#1f2937">${title}</text>`;
  for (let g = 0; g <= 4; g++) { const yv = (yMax / 4) * g, y = sy(yv); svg += `<line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#eef2f7"/><text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${fmt(yv)}</text>`; }
  svg += `<text transform="translate(16,${pad.t + ih / 2}) rotate(-90)" text-anchor="middle" font-size="11" fill="#6b7280">${ylabel}</text>`;
  bars.forEach((b, i) => {
    const x = pad.l + gap / 2 + i * (bw + gap), y = sy(b.value);
    svg += `<rect x="${x}" y="${y}" width="${bw}" height="${pad.t + ih - y}" rx="4" fill="${b.color}"/>`;
    svg += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#1f2937">${fmt(b.value)}</text>`;
    svg += `<text x="${x + bw / 2}" y="${height - pad.b + 18}" text-anchor="middle" font-size="11" fill="#6b7280">${b.label}</text>`;
  });
  return svg + '</svg>';
}

const fmt = (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Math.round(v * 100) / 100);

function renderReport(r) {
  const sw = r.correctnessSweep.points;
  const swYMax = Math.max(...sw.map((p) => p.naive)) * 1.1;
  const correctnessSvg = lineChart({
    title: 'Billing correctness under a retry storm',
    xlabel: 'retry multiplier (times each event is sent)', ylabel: 'events billed',
    xticks: sw.map((p) => p.retry), yMax: swYMax,
    series: [
      { name: 'naive (today)', color: '#be123c', points: sw.map((p) => [p.retry, p.naive]) },
      { name: 'idempotent (fix)', color: '#166534', points: sw.map((p) => [p.retry, p.idempotent]) },
      { name: 'truth', color: '#94a3b8', dashed: true, points: sw.map((p) => [p.retry, p.truth]) },
    ],
  });

  const ld = r.loadSweep.points;
  const tpYMax = Math.max(...ld.map((p) => p.throughput)) * 1.15;
  const throughputSvg = lineChart({
    title: 'Throughput vs concurrency', xlabel: 'offered concurrency', ylabel: 'requests / sec',
    xticks: ld.map((p) => p.concurrency), yMax: tpYMax,
    series: [{ name: 'throughput', color: '#2563eb', points: ld.map((p) => [p.concurrency, p.throughput]) }],
  });
  const latYMax = Math.max(...ld.map((p) => p.p99)) * 1.15;
  const latencySvg = lineChart({
    title: 'Latency vs concurrency (the knee)', xlabel: 'offered concurrency', ylabel: 'latency (ms)',
    xticks: ld.map((p) => p.concurrency), yMax: latYMax,
    series: [
      { name: 'p99', color: '#be123c', points: ld.map((p) => [p.concurrency, p.p99]) },
      { name: 'p95', color: '#d97706', points: ld.map((p) => [p.concurrency, p.p95]) },
      { name: 'p50', color: '#166534', points: ld.map((p) => [p.concurrency, p.p50]) },
    ],
  });
  const h = r.headline;
  const percentileSvg = barChart({
    title: `Headline latency percentiles (idempotent, ${h.totalRequests.toLocaleString()} reqs)`,
    ylabel: 'ms', yMax: Math.max(h.idempotent.p99, 1) * 1.25,
    bars: [
      { label: 'p50', value: h.idempotent.p50, color: '#166534' },
      { label: 'p95', value: h.idempotent.p95, color: '#d97706' },
      { label: 'p99', value: h.idempotent.p99, color: '#be123c' },
    ],
  });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Idempotent Ingestion — Benchmark Report</title><style>
*{box-sizing:border-box}body{margin:0;padding:0 0 60px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1f2937;background:#f8fafc;line-height:1.6}
header{background:linear-gradient(135deg,#0f172a,#312e81);color:#fff;padding:30px 22px}header h1{margin:0 0 6px;font-size:22px}header p{margin:0;color:#c7d2fe;font-size:14px}
.wrap{max-width:880px;margin:0 auto;padding:0 18px}section{margin-top:28px}h2{font-size:18px;border-bottom:2px solid #d1d5db;padding-bottom:8px}
.chart{background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:10px;margin:14px 0}.chart svg{width:100%;height:auto;display:block}
table{width:100%;border-collapse:collapse;font-size:13.5px;background:#fff;border:1px solid #d1d5db;border-radius:10px;overflow:hidden;margin:12px 0}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #eef2f7}th{background:#f1f5f9;font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:#6b7280}
.ok{color:#166534;font-weight:700}.bad{color:#be123c;font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}
.kpi{background:#0f172a;color:#fff;border-radius:12px;padding:14px;text-align:center}.kpi .v{font-size:24px;font-weight:800;color:#a5b4fc}.kpi.bad .v{color:#fca5a5}.kpi .l{font-size:11px;color:#94a3b8;margin-top:3px}
.note{background:#ecfeff;border-left:4px solid #0f766e;padding:11px 15px;border-radius:8px;font-size:14px;margin:14px 0}
code{background:#eef2f7;padding:1px 5px;border-radius:4px;font-size:13px}
</style></head><body>
<header><h1>Idempotent Ingestion — Benchmark Report</h1><p>PulsePoint at Scale · Part B spike · generated ${new Date(r.generatedAt).toUTCString()} · ${r.node}</p></header>
<div class="wrap">

<section><h2>Headline: ${h.totalRequests.toLocaleString()} requests, ${h.uniqueEvents.toLocaleString()} real events (each sent ${h.retryMultiplier}×)</h2>
<div class="kpis">
  <div class="kpi"><div class="v">${h.idempotent.billedCount.toLocaleString()}</div><div class="l">idempotent billed<br><span class="ok">${h.idempotent.exact ? 'EXACT ✓' : 'WRONG'}</span></div></div>
  <div class="kpi bad"><div class="v">${h.naive.billedCount.toLocaleString()}</div><div class="l">naive billed<br><span class="bad">${h.naive.overcountFactor}× over ✗</span></div></div>
  <div class="kpi"><div class="v">${h.idempotent.throughput.toLocaleString()}</div><div class="l">req/sec (idempotent)</div></div>
  <div class="kpi"><div class="v">${h.idempotent.p95} ms</div><div class="l">p95 latency</div></div>
</div>
<div class="note">💡 The naive endpoint (today's <code>feedback.ts</code>) counts every request, so ${h.retryMultiplier} retries become a <b>${h.naive.overcountFactor}× wrong invoice</b>. The idempotent endpoint absorbed <b>${h.idempotent.deduped.toLocaleString()}</b> duplicate requests and still billed exactly <b>${h.uniqueEvents.toLocaleString()}</b> — and did it cheaper per duplicate (a hash lookup, not a write).</div>
<div class="chart">${percentileSvg}</div>
</section>

<section><h2>1 · Correctness under a retry storm — graceful vs cliff</h2>
<div class="chart">${correctnessSvg}</div>
<p>As clients retry more aggressively (x-axis), the naive count climbs linearly away from truth — a <b>billing cliff</b>. The idempotent line sits exactly on truth no matter how hard clients retry — <b>graceful</b>. This is the whole point: correctness is independent of delivery count.</p>
<table><tr><th>retry ×</th><th>truth</th><th>idempotent</th><th>naive</th><th>naive error</th></tr>
${sw.map((p) => `<tr><td>${p.retry}×</td><td>${p.truth.toLocaleString()}</td><td class="ok">${p.idempotent.toLocaleString()}</td><td class="bad">${p.naive.toLocaleString()}</td><td class="bad">+${(((p.naive - p.truth) / p.truth) * 100).toFixed(0)}%</td></tr>`).join('')}
</table></section>

<section><h2>2 · Throughput &amp; latency vs load (the failure mode)</h2>
<div class="chart">${throughputSvg}</div>
<div class="chart">${latencySvg}</div>
<table><tr><th>concurrency</th><th>throughput (req/s)</th><th>p50</th><th>p95</th><th>p99</th></tr>
${ld.map((p) => `<tr><td>${p.concurrency}</td><td>${p.throughput.toLocaleString()}</td><td>${p.p50} ms</td><td>${p.p95} ms</td><td>${p.p99} ms</td></tr>`).join('')}
</table>
<p>Throughput rises, then saturates as the single server maxes out; past the knee, extra concurrency buys no throughput and only grows latency — a <b>graceful</b> degradation (queueing), not a crash. In production this is the signal to add ingest nodes (the design's ~10-node fleet). <em>Note:</em> server and load generator share one machine here, so absolute numbers are conservative; the <b>shape</b> is what matters.</p>
</section>

<footer style="margin-top:36px;padding-top:18px;border-top:2px solid #d1d5db;color:#6b7280;font-size:13px">Reproduce: <code>node bench.mjs</code> · raw data in <code>results.json</code></footer>
</div></body></html>`;
}

main();
