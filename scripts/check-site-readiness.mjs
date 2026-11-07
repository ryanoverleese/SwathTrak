import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(rel) {
  const file = path.join(dist, rel);
  if (!fs.existsSync(file)) {
    fail(`missing dist file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function titleOf(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? '';
}

function descriptionOf(html) {
  return html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1]
    ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/i)?.[1]
    ?? '';
}

const indexHtml = read('index.html');
const privacyHtml = read('privacy.html');
const notFoundHtml = read('404.html');
const robots = read('robots.txt');
const sitemap = read('sitemap.xml');
const redirects = read('_redirects');

const titles = [titleOf(indexHtml), titleOf(privacyHtml), titleOf(notFoundHtml)];
if (titles.some((title) => !title)) fail(`blank title: ${titles.join(' | ')}`);
if (new Set(titles).size !== 3) fail(`titles are not page-specific: ${titles.join(' | ')}`);

const descriptions = [descriptionOf(indexHtml), descriptionOf(privacyHtml), descriptionOf(notFoundHtml)];
if (descriptions.some((description) => description.length < 20)) {
  fail(`missing description: ${descriptions.join(' | ')}`);
}
if (new Set(descriptions).size !== 3) fail('descriptions are not page-specific');

for (const [name, html] of [['index', indexHtml], ['privacy', privacyHtml]]) {
  if (!html.includes('property="og:image"') && !html.includes("property='og:image'")) {
    fail(`${name} missing og:image`);
  }
  if (!html.includes('/icon-512.png')) fail(`${name} og image is not the existing brand icon`);
  for (const icon of ['/favicon.ico', '/favicon-32x32.png', '/favicon-16x16.png', '/apple-touch-icon.png']) {
    if (!html.includes(icon)) fail(`${name} missing favicon link ${icon}`);
  }
}

if (!/noindex/i.test(notFoundHtml)) fail('404 page is not noindex');
if (!notFoundHtml.includes('href="/"')) fail('404 page missing link to the app');
if (!notFoundHtml.includes('alt=""')) fail('decorative 404 image needs an empty alt');
if (notFoundHtml.includes('/assets/') || notFoundHtml.includes('/src/main')) {
  fail('404 page should not boot the spray app');
}

if (!robots.includes('Sitemap: https://swathtrak.netlify.app/sitemap.xml')) {
  fail('robots.txt missing sitemap');
}
if (/^Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt blocks the whole site');

const locs = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]);
const expectedLocs = [
  'https://swathtrak.netlify.app/',
  'https://swathtrak.netlify.app/privacy.html',
];
if (locs.length !== expectedLocs.length || expectedLocs.some((loc) => !locs.includes(loc))) {
  fail(`sitemap URLs: ${locs.join(', ')}`);
}
const privateHints = /session|customer|field|tank|lat=|lng=|latitude|longitude/i;
if (privateHints.test(sitemap) || privateHints.test(indexHtml.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? '')) {
  fail('sitemap or home metadata contains a private field or customer hint');
}

const redirectLines = redirects.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
if (!redirectLines.some((line) => line.startsWith('/privacy') && line.includes('/privacy.html') && line.endsWith('301'))) {
  fail('privacy redirect missing');
}
if (redirectLines.some((line) => /\/\*\s+\/index\.html\s+200/.test(line) || /status\s*=\s*200/.test(line))) {
  fail('SPA catch-all would hide real 404 status');
}

const sourcePolicy = fs.readFileSync(path.join(root, 'docs/privacy-policy.html'), 'utf8');
const publishedPolicy = fs.readFileSync(path.join(root, 'public/privacy.html'), 'utf8');
for (const paragraph of sourcePolicy.match(/<p[\s\S]*?<\/p>/g) ?? []) {
  if (!publishedPolicy.includes(paragraph) || !privacyHtml.includes(paragraph)) {
    fail(`privacy page dropped legal text: ${paragraph.slice(0, 80)}`);
  }
}
if (!publishedPolicy.includes('does not include analytics')) {
  fail('privacy policy no longer states that analytics is absent');
}

const trackers = /googletagmanager|google-analytics|gtag\(|plausible|posthog|segment\.com|mixpanel|hotjar/i;
for (const [name, html] of [['index', indexHtml], ['privacy', privacyHtml], ['404', notFoundHtml]]) {
  if (trackers.test(html)) fail(`${name} includes an analytics script`);
}

for (const file of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  const filePath = path.join(dist, file);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100) fail(`favicon asset missing: ${file}`);
}

const bundled = fs.readdirSync(path.join(dist, 'assets')).filter((name) => name.endsWith('.js')).map((name) => fs.readFileSync(path.join(dist, 'assets', name), 'utf8')).join('\n');
if (!bundled.includes('SPRAY')) fail('built app is missing the SPRAY action');
if (!bundled.includes('Loading map')) fail('built app is missing the map loading state');
if (!bundled.includes('GPS: locating')) fail('built app is missing the GPS locating state');

const mime = {
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.ico': 'image/vnd.microsoft.icon',
  '.png': 'image/png',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

function fileFor(urlPath) {
  const rel = decodeURIComponent(urlPath);
  if (rel.includes('\0') || rel.split('/').includes('..')) return null;
  let file = path.join(dist, rel);
  if (rel.endsWith('/')) file = path.join(file, 'index.html');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  return null;
}

const redirectRules = redirects
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [from, to, status] = line.split(/\s+/);
    return { from, to, status: Number(status) };
  });

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const rule = redirectRules.find((entry) => entry.from === url.pathname);
  if (rule) {
    res.writeHead(rule.status, { Location: rule.to });
    res.end();
    return;
  }
  const file = fileFor(url.pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(dist, '404.html')).pipe(res);
    return;
  }
  const type = mime[path.extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function request(urlPath, redirect) {
  const response = await fetch(base + urlPath, { redirect });
  const body = Buffer.from(await response.arrayBuffer());
  return { status: response.status, type: response.headers.get('content-type') ?? '', location: response.headers.get('location'), body };
}

const home = await request('/', 'manual');
if (home.status !== 200 || !home.body.toString().includes('SwathTrak — ATV spray tracker')) {
  fail(`home status/content ${home.status}`);
}

const missing = await request('/fields/customer-12', 'manual');
if (missing.status !== 404) fail(`unknown URL status ${missing.status}, expected 404`);
const missingText = missing.body.toString();
if (!missingText.includes('Page not found') || !missingText.includes('noindex')) {
  fail('unknown URL did not return the custom 404');
}
if (missingText.includes('id="root"')) fail('unknown URL served the app shell');

const privacyRedirect = await request('/privacy', 'manual');
if (privacyRedirect.status !== 301 || privacyRedirect.location !== '/privacy.html') {
  fail(`privacy redirect ${privacyRedirect.status} ${privacyRedirect.location}`);
}
const privacy = await request('/privacy.html', 'manual');
if (privacy.status !== 200 || !privacy.body.toString().includes('does not include analytics')) {
  fail('privacy page was not served');
}

const robotsResponse = await request('/robots.txt', 'manual');
if (robotsResponse.status !== 200 || !robotsResponse.type.includes('text/plain')) {
  fail(`robots response ${robotsResponse.status} ${robotsResponse.type}`);
}
const sitemapResponse = await request('/sitemap.xml', 'manual');
if (sitemapResponse.status !== 200 || !sitemapResponse.body.toString().includes('privacy.html')) {
  fail('sitemap was not served');
}

const favicon = await request('/favicon.ico', 'manual');
const faviconFile = fs.readFileSync(path.join(dist, 'favicon.ico'));
if (favicon.status !== 200 || !favicon.type.includes('icon') || !favicon.body.equals(faviconFile)) {
  fail('favicon.ico was not the generated brand icon');
}

server.close();

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log('site readiness checks passed');
console.log(titles.map((title, index) => `${title} :: ${descriptions[index]}`).join('\n'));
