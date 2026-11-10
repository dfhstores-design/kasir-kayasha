/*
 * Kasir Kayasha — pembuat wireframe Phase 1
 * Menghasilkan satu berkas HTML mandiri (tanpa dependensi, tanpa internet, tanpa data).
 *
 * Jalankan dari root repo:
 *   node docs/design/tools/build-wireframe.mjs ../../artifacts/PHASE-01/wireframe.html
 *
 * Sumber : docs/design/wireframe.src.mjs
 * Hasil  : berkas HTML yang diberikan sebagai argumen
 */
import { SCREENS, DEVICE_VIEWS } from "../wireframe.src.mjs";
import { writeFileSync } from "node:fs";

const out = process.argv[2];

if (!out) {
  console.error("Pemakaian: node docs/design/tools/build-wireframe.mjs <path-keluaran.html>");
  process.exit(1);
}

const html = renderHtml(SCREENS, DEVICE_VIEWS);
writeFileSync(out, html, "utf8");
console.log(`wireframe.html ditulis: ${out} (${html.length} karakter, ${SCREENS.length} layar)`);

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(screens, views) {
  const nav = screens
    .map((s, i) => `<button class="nav" data-i="${i}"><b>${esc(s.no)}</b> ${esc(s.title)}</button>`)
    .join("\n");

  const frames = screens
    .map((s, i) => `<section class="frame" id="f${i}">${s.body}</section>`)
    .join("\n");

  const device = views[0];

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kasir Kayasha — Wireframe Phase 1</title>
<style>
  :root {
    --bg: #f7f4ee;
    --surface: #ffffff;
    --ink: #1f2328;
    --ink-soft: #5a6068;
    --line: #ded8ce;
    --field-line: #8a8378;
    --primary: #8c3f2c;
    --accent: #2f6f5e;
    --warn-bg: #fbf0dc;
    --warn-ink: #7a4a00;
    --danger: #962718;
    --ph: #e9e4da;
    --ph-ink: #6f695e;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #ece7de; color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  body { font-size: 16px; }
  header.top { padding: 20px 24px; background: #fff; border-bottom: 1px solid var(--line); }
  header.top h1 { margin: 0; font-size: 20px; }
  header.top p { margin: 6px 0 0; color: var(--ink-soft); font-size: 14px; }
  .wrap { display: grid; grid-template-columns: 260px 1fr; gap: 24px; padding: 24px; align-items: start; }
  nav#nav { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 4px; max-height: calc(100vh - 48px); overflow: auto; }
  .nav { text-align: left; padding: 10px 12px; border: 1px solid var(--line); background: #fff;
    border-radius: 10px; font: inherit; font-size: 14px; cursor: pointer; color: var(--ink); }
  .nav b { color: var(--primary); display: inline-block; min-width: 22px; }
  .nav[aria-current="true"] { background: var(--primary); color: #fff; border-color: var(--primary); }
  .nav[aria-current="true"] b { color: #fff; }
  .stage { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; }
  .phone { width: 360px; background: #111; border-radius: 28px; padding: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
  .tablet { width: 768px; }
  .screen { background: var(--bg); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; min-height: 740px; }
  .tablet .screen { min-height: 900px; }
  .frame { display: none; flex-direction: column; flex: 1; }
  .frame.on { display: flex; }
  .caption { text-align: center; font-size: 13px; color: var(--ink-soft); margin-top: 8px; }

  /* komponen wireframe */
  .appbar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--surface);
    border-bottom: 1px solid var(--line); font-size: 18px; font-weight: 700; }
  .appbar .back { font-weight: 600; font-size: 16px; color: var(--primary); padding: 8px 6px; min-height: 48px; display: flex; align-items: center; }
  .content { padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
  .bottom { padding: 12px 16px 20px; display: flex; flex-direction: column; gap: 10px; background: var(--bg); border-top: 1px solid var(--line); }
  .btn { min-height: 60px; border-radius: 16px; border: 0; font: inherit; font-size: 20px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; text-align: center; cursor: pointer; }
  .btn.primary { background: var(--primary); color: #fff; }
  .btn.ghost { background: #fff; color: var(--ink); border: 2px solid var(--field-line); }
  .btn.small { min-height: 48px; font-size: 18px; }
  .btn[disabled] { opacity: .55; cursor: not-allowed; }
  .big { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .big .btn { min-height: 88px; }
  .big .btn.hero { grid-column: 1 / -1; min-height: 104px; font-size: 24px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 14px; }
  .h1 { font-size: 26px; font-weight: 700; margin: 0; }
  .h2 { font-size: 20px; font-weight: 700; margin: 0; }
  .muted { color: var(--ink-soft); font-size: 16px; }
  .money { font-weight: 700; }
  .total { font-size: 34px; font-weight: 700; }
  .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .hr { height: 1px; background: var(--line); margin: 4px 0; }
  .input { min-height: 56px; border: 2px solid var(--field-line); border-radius: 12px; background: #fff;
    display: flex; align-items: center; padding: 0 14px; color: var(--ph-ink); font-size: 18px; }
  .label { font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .thumb { background: var(--ph); border-radius: 12px; display: flex; align-items: center; justify-content: center;
    color: var(--ph-ink); font-size: 13px; text-align: center; padding: 6px; }
  .thumb.sq { aspect-ratio: 1/1; }
  .prodname { font-weight: 700; font-size: 17px; margin-top: 8px; line-height: 1.25; }
  .price { font-weight: 700; font-size: 18px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
    border: 1px solid var(--line); background: #fff; font-size: 15px; font-weight: 700; }
  .chip.ok { background: #e7f1ec; border-color: #bcd8cd; color: #1f5748; }
  .chip.warn { background: var(--warn-bg); border-color: #e8d3ad; color: var(--warn-ink); }
  .chip.off { background: #efece6; color: var(--ink-soft); }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .step { width: 56px; height: 56px; border-radius: 12px; border: 2px solid var(--field-line); background: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
  .step.num { border-color: var(--ink); }
  .btn:focus-visible, .nav:focus-visible, .listrow:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
  .qty { display: flex; gap: 10px; align-items: center; }
  .status { display: flex; align-items: center; gap: 8px; font-size: 16px; color: var(--ink-soft); }
  .dot { width: 10px; height: 10px; border-radius: 999px; background: var(--accent); flex: 0 0 auto; }
  .dot.warn { background: #c98a1d; }
  .warnbox { background: var(--warn-bg); color: var(--warn-ink); border-radius: 12px; padding: 12px; font-size: 16px; }
  .okbox { background: #e7f1ec; color: #1f5748; border-radius: 12px; padding: 12px; font-size: 16px; }
  .check { width: 88px; height: 88px; border-radius: 999px; background: var(--accent); color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 48px; margin: 24px auto 8px; }
  .center { text-align: center; }
  .listrow { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px;
    display: flex; gap: 12px; align-items: center; }
  .listrow .chev { margin-left: auto; color: var(--ink-soft); }
  .thumblist { width: 56px; height: 56px; flex: 0 0 auto; }
  .navitem { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 16px;
    display: flex; align-items: center; justify-content: space-between; font-size: 18px; font-weight: 600; }
  .receipt { background: #fff; border: 1px dashed #b9b2a5; border-radius: 8px; padding: 14px; font-size: 15px; }
  .receipt .center { font-size: 15px; }
  .receipt .row { margin: 3px 0; }
  .logobox { width: 84px; height: 84px; border-radius: 8px; background: var(--ph); margin: 0 auto 6px; }
  .strike { text-decoration: line-through; color: var(--ink-soft); }
  .phone { position: relative; }
  .phone .screen { position: relative; }
  @media (max-width: 1100px) { .wrap { grid-template-columns: 1fr; } nav#nav { position: static; flex-direction: row; flex-wrap: wrap; max-height: none; } }
</style>
</head>
<body>
<header class="top">
  <h1>Kasir Kayasha — Wireframe Phase 1</h1>
  <p>Gambaran layar MVP (±360 × 740 px, skala HP kecil). Tanpa fungsi nyata — untuk menyetujui alur dan tata letak
     sebelum kode ditulis. Spesifikasi warna, ukuran, dan teks: <code>docs/design/UI-SPEC.md</code>.</p>
</header>
<div class="wrap">
  <nav id="nav" aria-label="Daftar layar">
${nav}
  </nav>
  <div class="stage">
    <div>
      <div class="phone"><div class="screen">
${frames}
      </div></div>
      <div class="caption">${esc(device.label)}</div>
    </div>
  </div>
</div>
<script>
  var items = Array.prototype.slice.call(document.querySelectorAll('.nav'));
  var frames = Array.prototype.slice.call(document.querySelectorAll('.frame'));
  function show(i) {
    frames.forEach(function (f, j) { f.classList.toggle('on', i === j); });
    items.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    document.title = 'Kasir Kayasha — Layar ' + (i + 1);
  }
  items.forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); });
  document.addEventListener('keydown', function (e) {
    var cur = items.findIndex(function (b) { return b.getAttribute('aria-current') === 'true'; });
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { show(Math.min(items.length - 1, cur + 1)); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { show(Math.max(0, cur - 1)); }
  });
  show(0);
</script>
</body>
</html>`;
}
