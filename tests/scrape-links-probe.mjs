import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const linksPath = path.join(__dirname, 'test-links.md');
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(repoRoot, 'data');
const cookiesPath = path.join(dataDir, 'cookies.json');

const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(__dirname, 'scrape-output', runStamp);
fs.mkdirSync(outDir, { recursive: true });
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffa-scrape-probe-'));

function readLinks() {
  const content = fs.readFileSync(linksPath, 'utf8');
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .filter(line => /^https?:\/\//i.test(line));
}

function loadCookies() {
  try {
    if (!fs.existsSync(cookiesPath)) return [];
    const parsed = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function slugForUrl(url, index) {
  const u = new URL(url);
  const tail = `${u.hostname}${u.pathname}`
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .toLowerCase();
  return `${String(index + 1).padStart(2, '0')}-${tail || 'page'}`;
}

function cleanText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWords(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

async function launchBrowser() {
  const opts = {
    headless: false,
    userDataDir: profileDir,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  };
  try {
    return await puppeteer.launch({ ...opts, channel: 'chrome' });
  } catch {
    return puppeteer.launch(opts);
  }
}

async function fetchTextDownloads(page, links) {
  const downloads = [];
  for (const href of links.slice(0, 10)) {
    try {
      const result = await page.evaluate(async (url) => {
        const res = await fetch(url);
        if (!res.ok) return { ok: false, status: res.status, text: '' };
        const text = await res.text();
        return { ok: true, status: res.status, text };
      }, href);
      downloads.push({
        href,
        ok: !!result.ok,
        status: result.status,
        chars: result.text?.length || 0,
        words: countWords(result.text || ''),
        text: cleanText(result.text || ''),
      });
    } catch (err) {
      downloads.push({ href, ok: false, error: err.message, chars: 0, words: 0, text: '' });
    }
  }
  return downloads;
}

async function scrapePage(browser, url, index, cookies) {
  const page = await browser.newPage();
  if (cookies.length > 0) {
    await page.setCookie(...cookies).catch(() => {});
  }

  const startedAt = new Date().toISOString();
  const slug = slugForUrl(url, index);
  const events = [];
  const log = (message, data = {}) => events.push({ ts: new Date().toISOString(), message, ...data });

  log('opening', { url });
  let responseStatus = null;
  let error = null;
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    responseStatus = response?.status() ?? null;
    log('domcontentloaded', { status: responseStatus, finalUrl: page.url() });
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 15_000 }).catch(() => {
      log('network-idle-timeout');
    });
    await new Promise(resolve => setTimeout(resolve, 2500));
  } catch (err) {
    error = err.message;
    log('navigation-error', { error });
  }

  const extracted = await page.evaluate(() => {
    const title = document.title || '';
    const bodyText = document.body?.innerText || '';
    const fedora = document.querySelector('meta#fedora-data');
    const anchors = [...document.querySelectorAll('a[href]')].map(a => ({
      href: a.href,
      text: (a.innerText || a.textContent || '').trim(),
    }));
    const iframes = [...document.querySelectorAll('iframe[src]')].map(f => f.src);
    const textDownloadLinks = anchors
      .map(a => a.href)
      .filter(href => /\.txt(?:$|\?)/i.test(href));
    const notionLinks = anchors
      .map(a => a.href)
      .filter(href => /notion\.(site|so)/i.test(href));
    const attachmentBlocks = [...document.querySelectorAll('.lecture-attachment')].map((el, i) => ({
      index: i,
      className: el.className || '',
      text: (el.innerText || '').trim().slice(0, 2000),
      links: [...el.querySelectorAll('a[href]')].map(a => a.href),
      iframes: [...el.querySelectorAll('iframe[src]')].map(f => f.src),
    }));
    return {
      title,
      finalUrl: location.href,
      bodyText,
      fedoraPreview: fedora?.getAttribute('data-preview') || null,
      fedoraCourseId: fedora?.getAttribute('data-course-id') || null,
      hasSigninForm: !!document.querySelector('form[action*="sign_in"], input[type="password"]'),
      anchors,
      iframes,
      textDownloadLinks,
      notionLinks,
      attachmentBlocks,
    };
  }).catch(err => ({
    title: '',
    finalUrl: page.url(),
    bodyText: '',
    evalError: err.message,
    anchors: [],
    iframes: [],
    textDownloadLinks: [],
    notionLinks: [],
    attachmentBlocks: [],
  }));

  const visibleText = cleanText(extracted.bodyText || '');
  const downloads = await fetchTextDownloads(page, extracted.textDownloadLinks || []);
  const downloadedText = cleanText(downloads.filter(d => d.text).map(d => d.text).join('\n\n--- downloaded transcript ---\n\n'));
  const bestText = downloadedText || visibleText;
  const words = countWords(bestText);
  const chars = bestText.length;
  const completedAt = new Date().toISOString();

  const summary = {
    index: index + 1,
    inputUrl: url,
    finalUrl: extracted.finalUrl || page.url(),
    title: extracted.title || '',
    responseStatus,
    error,
    startedAt,
    completedAt,
    visibleChars: visibleText.length,
    visibleWords: countWords(visibleText),
    downloadedTranscriptChars: downloadedText.length,
    downloadedTranscriptWords: countWords(downloadedText),
    bestChars: chars,
    bestWords: words,
    textDownloadCount: extracted.textDownloadLinks?.length || 0,
    notionLinkCount: extracted.notionLinks?.length || 0,
    iframeCount: extracted.iframes?.length || 0,
    attachmentCount: extracted.attachmentBlocks?.length || 0,
    fedoraPreview: extracted.fedoraPreview || null,
    fedoraCourseId: extracted.fedoraCourseId || null,
    hasSigninForm: !!extracted.hasSigninForm,
    evalError: extracted.evalError || null,
    events,
  };

  fs.writeFileSync(path.join(outDir, `${slug}.txt`), bestText || visibleText || '', 'utf8');
  fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify({
    summary,
    downloads: downloads.map(d => ({ ...d, text: undefined })),
    textDownloadLinks: extracted.textDownloadLinks || [],
    notionLinks: extracted.notionLinks || [],
    iframes: extracted.iframes || [],
    attachmentBlocks: extracted.attachmentBlocks || [],
    anchorSample: (extracted.anchors || []).slice(0, 80),
  }, null, 2), 'utf8');
  await page.screenshot({ path: path.join(outDir, `${slug}.png`), fullPage: true }).catch(() => {});
  await page.close().catch(() => {});
  return summary;
}

const links = readLinks();
const cookies = loadCookies();
const browser = await launchBrowser();
const summaries = [];

try {
  for (let i = 0; i < links.length; i++) {
    summaries.push(await scrapePage(browser, links[i], i, cookies));
  }
} finally {
  await browser.close().catch(() => {});
  fs.rmSync(profileDir, { recursive: true, force: true });
}

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({
  runStamp,
  linksPath,
  outDir,
  cookieCount: cookies.length,
  totals: {
    urls: summaries.length,
    bestChars: summaries.reduce((sum, s) => sum + s.bestChars, 0),
    bestWords: summaries.reduce((sum, s) => sum + s.bestWords, 0),
    textDownloads: summaries.reduce((sum, s) => sum + s.textDownloadCount, 0),
    attachments: summaries.reduce((sum, s) => sum + s.attachmentCount, 0),
  },
  pages: summaries,
}, null, 2), 'utf8');

const lines = [
  `# Scrape Probe ${runStamp}`,
  '',
  `Links: ${summaries.length}`,
  `Output: ${outDir}`,
  `Cookies loaded: ${cookies.length}`,
  '',
  '| # | Status | Words | Chars | Downloads | Attachments | Title | URL |',
  '|---:|---:|---:|---:|---:|---:|---|---|',
  ...summaries.map(s => `| ${s.index} | ${s.responseStatus ?? ''}${s.error ? ' error' : ''} | ${s.bestWords} | ${s.bestChars} | ${s.textDownloadCount} | ${s.attachmentCount} | ${s.title.replace(/\|/g, '\\|')} | ${s.finalUrl} |`),
  '',
  '## Notes',
  '',
  '- `best` text uses downloaded `.txt` transcript content when available; otherwise it uses visible page text.',
  '- Each URL has `.txt`, `.json`, and `.png` artifacts in this folder.',
];
fs.writeFileSync(path.join(outDir, 'README.md'), lines.join('\n'), 'utf8');

console.log(JSON.stringify({ outDir, summaries }, null, 2));
