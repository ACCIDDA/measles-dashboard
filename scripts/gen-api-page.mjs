#!/usr/bin/env node
// Render docs/API.md into a standalone, on-site HTML page (#93).
//
// The API reference already lives in docs/API.md, but it is only reachable on
// GitHub (via the README) — a visitor on the deployed dashboard has no path to
// it. This script renders that same markdown into public/api.html so the page
// ships with the site and the header can link straight to it. The markdown
// stays the single source of truth; this is a view of it, regenerated in
// predev/prebuild like the other static artifacts.
//
//   node scripts/gen-api-page.mjs        # write public/api.html from docs/API.md
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_MD = join(ROOT, 'docs', 'API.md');
const OUT = join(ROOT, 'public', 'api.html');

const NUL = String.fromCharCode(0);

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Heading text → anchor id, matching the in-doc `#machine-readable-schema`
// style links: lowercase, non-alphanumerics to hyphens, trimmed.
const slugId = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Inline spans: code, links, bold, italic. Code spans are extracted first
// behind a NUL-delimited sentinel (so their index can't collide with prose
// like "95%") and restored last, after all other inline processing.
function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `${NUL}${codes.length - 1}${NUL}`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const external = /^https?:\/\//.test(href);
    const attrs = external ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${attrs}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s.replace(new RegExp(`${NUL}(\\d+)${NUL}`, 'g'), (_, i) => codes[Number(i)]);
}

function renderTable(rows) {
  const cells = (line) =>
    line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2); // rows[1] is the |---| separator
  const thead = `<tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>`;
  const tbody = body
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table>\n<thead>${thead}</thead>\n<tbody>\n${tbody}\n</tbody>\n</table>`;
}

function mdToHtml(md) {
  // Drop generator sentinels (`<!-- BEGIN/END GENERATED -->`) and any comments.
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out = [];
  let para = [];
  let list = [];
  let quote = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>\n${list.map((li) => `<li>${inline(li)}</li>`).join('\n')}\n</ul>`);
    list = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
    quote = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block — copied verbatim, no inline processing.
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      flushAll();
      const lang = fence[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      const cls = lang ? ` class="language-${lang}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Table — a pipe row immediately followed by a |---| separator.
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
      flushAll();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      out.push(renderTable(rows));
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2];
      out.push(`<h${level} id="${slugId(text)}">${inline(text)}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^>\s?/, '')); continue; }
    if (/^[-*]\s+/.test(line)) { flushPara(); flushQuote(); list.push(line.replace(/^[-*]\s+/, '')); continue; }

    if (line.trim() === '') { flushAll(); continue; }
    // A non-blank line with no marker continues the open block: a wrapped list
    // item stays in the <li>; otherwise it extends the current paragraph.
    if (list.length) { list[list.length - 1] += ` ${line.trim()}`; continue; }
    flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

const CSS = `
:root{
  --bg:#f5f0e8;--surface:#faf7f2;--border:#e2d9cc;--border2:#cfc4b4;
  --text:#1c1917;--muted:#78716c;--faint:#ede8e0;--acc:#1B4F72;--focus:#005fcc;
  --mono:'ui-monospace','SFMono-Regular','Menlo','Consolas',monospace;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.6;
  -webkit-font-smoothing:antialiased}
.topbar{position:sticky;top:0;background:var(--surface);border-bottom:1px solid var(--border);
  padding:10px 16px;display:flex;align-items:center;gap:10px;z-index:10}
.topbar a.back{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;
  border:1px solid var(--border2);border-radius:8px;background:var(--faint);color:var(--text);
  font-size:13px;font-weight:500;text-decoration:none}
.topbar a.back:hover{background:var(--surface)}
.topbar .crumb{font-size:13px;color:var(--muted)}
main{max-width:820px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:28px;letter-spacing:-.01em;margin:8px 0 16px}
h2{font-size:21px;margin:36px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)}
h3{font-size:16px;margin:26px 0 8px}
h4{font-size:14px;margin:20px 0 6px;color:var(--muted)}
p{margin:12px 0}
a{color:var(--acc)}
a:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:3px}
ul{margin:12px 0 12px 22px}
li{margin:4px 0}
code{font-family:var(--mono);font-size:.88em;background:var(--faint);border:1px solid var(--border);
  border-radius:4px;padding:1px 5px}
pre{background:#1c1917;color:#f5f0e8;border-radius:10px;padding:14px 16px;overflow-x:auto;margin:14px 0}
pre code{background:none;border:none;padding:0;color:inherit;font-size:13px;line-height:1.5}
blockquote{margin:14px 0;padding:8px 16px;border-left:3px solid var(--border2);
  background:var(--surface);color:var(--muted);border-radius:0 6px 6px 0}
blockquote p{margin:0}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;display:block;overflow-x:auto}
th,td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}
th{background:var(--faint);font-weight:600}
tbody tr:nth-child(even){background:var(--surface)}
@media(max-width:640px){main{padding:24px 14px 60px}h1{font-size:23px}}
`;

const body = mdToHtml(readFileSync(API_MD, 'utf8'));
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Data API · Measles Vaccination (MMR) Coverage</title>
<meta name="description" content="Static CSV dataset API for the measles MMR coverage dashboard: URL scheme, columns, and examples." />
<style>${CSS}</style>
</head>
<body>
<div class="topbar">
  <a class="back" href="./">&larr; Dashboard</a>
  <span class="crumb">Data API reference</span>
</div>
<main>
${body}
</main>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`Wrote ${OUT.replace(ROOT + '/', '')} (${html.length} bytes) from docs/API.md`);
