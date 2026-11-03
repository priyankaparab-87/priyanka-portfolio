// ---------------------------------------------------------------------
// Builds the password-protected (NDA) case study pages.
//
// Plaintext sources live in _nda-src/ (gitignored, never published):
//   _nda-src/case-study-*.html   the real pages
//   _nda-src/images/*.webp       their screenshots
//   _nda-src/PASSWORD            the shared password
//
// For each source page, the <body> is encrypted (AES-256-GCM, key from
// PBKDF2-SHA256) with its screenshots inlined as data URIs, and written
// to the repo root. The published page only contains ciphertext;
// nda-gate.js decrypts it in the browser once the password is entered.
//
// Usage: node _tools/build-nda.mjs
// ---------------------------------------------------------------------
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, '_nda-src');
const ITERATIONS = 600000;

const b64 = (buf) => Buffer.from(buf).toString('base64');

const password = readFileSync(join(SRC, 'PASSWORD'), 'utf8').trim();
if (!password) throw new Error('_nda-src/PASSWORD is empty');

// One salt per build, shared by every page, so a visitor who unlocks one
// case study can open the others without retyping the password.
const salt = crypto.getRandomValues(new Uint8Array(16));
const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
);

function inlineImages(html) {
  return html.replace(/src="images\/([a-z0-9._-]+)\.png"/g, (match, name) => {
    const file = join(SRC, 'images', name + '.webp');
    if (!existsSync(file)) throw new Error('Missing NDA image: ' + file);
    return 'src="data:image/webp;base64,' + b64(readFileSync(file)) + '"';
  });
}

const pages = readdirSync(SRC).filter((f) => /^case-study-.+\.html$/.test(f));
for (const page of pages) {
  const source = readFileSync(join(SRC, page), 'utf8');
  const bodyMatch = source.match(/<body([^>]*)>([\s\S]*)<\/body>/);
  if (!bodyMatch) throw new Error('No <body> in ' + page);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(inlineImages(bodyMatch[2]));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const payload = JSON.stringify({ v: 1, iter: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ciphertext) });

  const head = source
    .slice(0, bodyMatch.index)
    .replace(/\s*<script src="password-gate\.js"><\/script>/, '')
    // The description shows up in link previews, so keep NDA details out of it
    .replace(/(<meta name="description" content=")[^"]*/, '$1Case study under NDA. Password required.')
    .replace('</head>', '  <script src="nda-gate.js" defer></script>\n</head>');

  const out =
    head +
    '<body' + bodyMatch[1] + '>\n' +
    '  <noscript><p style="padding:24px">This case study is under NDA and needs JavaScript to unlock.</p></noscript>\n' +
    '  <script type="application/json" id="nda-payload">' + payload + '</script>\n' +
    '</body>\n</html>\n';

  if (/<img[^>]+src="images\/(?!favicon|apple-touch)/.test(out)) throw new Error('Plaintext image reference leaked in ' + page);
  writeFileSync(join(ROOT, page), out);
  console.log(page + ': ' + Math.round(out.length / 1024) + ' KB');
}
