import {createHash} from 'node:crypto';
import {fromBufferPromise} from 'yauzl';

const mib = 1024 * 1024;
const maxHtml = 4 * mib, maxExpanded = 16 * mib;
const statuses = new Set(['passed','failed','skipped','timedOut','interrupted']);
const embedded = /(?:<template\s+id=["']playwrightReportBase64["'][^>]*>\s*|<script\s+id=["']playwrightReportBase64["'][^>]*>\s*|window\.playwrightReportBase64\s*=\s*["'])data:application\/zip;base64,([A-Za-z0-9+/=]+)/;

export function pinnedReportUrl(input) {
  const url = new URL(input);
  if (url.origin !== 'https://raw.githubusercontent.com' || url.username || url.password ||
      url.search || url.hash || !/^\/[\w.-]+\/[\w.-]+\/[a-f0-9]{40}\/(?:[\w.~-]+\/)*[\w.~-]+\.html$/.test(url.pathname)) {
    throw Error('Use a raw.githubusercontent.com HTML report URL pinned to a full commit SHA.');
  }
  return url.href;
}

async function bounded(stream,limit) {
  const parts = [];
  let size = 0;
  for await (const part of stream) {
    size += part.length;
    if (size > limit) throw Error('Playwright report exceeds the import size limit.');
    parts.push(part);
  }
  return Buffer.concat(parts);
}

export async function inspectReport(html,title) {
  if (html.length > maxHtml) throw Error('Playwright report exceeds 4 MiB.');
  const encoded = embedded.exec(html.toString('utf8'))?.[1];
  if (!encoded) throw Error('Expected a Playwright HTML report with an embedded report archive.');
  const zip = await fromBufferPromise(Buffer.from(encoded,'base64'));
  try {
    if (zip.entryCount > 500) throw Error('Too many entries in Playwright report.');
    const entries = new Map();
    let total = 0;
    for await (const entry of zip.eachEntry()) {
      total += entry.uncompressedSize;
      if (total > maxExpanded || entries.has(entry.fileName)) throw Error('Oversized or duplicate report entry.');
      entries.set(entry.fileName,entry);
    }
    const read = async name => {
      const entry = entries.get(name);
      if (!entry) throw Error('Incomplete Playwright archive.');
      return JSON.parse((await bounded(await zip.openReadStreamPromise(entry),entry.uncompressedSize)).toString('utf8'));
    };
    const index = await read('report.json');
    if (!Array.isArray(index.files) || index.files.length > 499) throw Error('Invalid Playwright report index.');
    const seen = new Set(), rows = [];
    for (const file of index.files) {
      if (!/^[\w-]{1,100}$/.test(file.fileId) || seen.has(file.fileId)) throw Error('Invalid or repeated Playwright file ID.');
      seen.add(file.fileId);
      const detail = await read(file.fileId+'.json');
      if (!Array.isArray(detail.tests)) throw Error('Invalid Playwright test list.');
      for (const entry of detail.tests) {
        if (entry.title !== title) continue;
        const location = entry.location;
        if (!location || typeof location.file !== 'string' || !location.file || location.file.length>500 ||
            !Number.isSafeInteger(location.line) || location.line<1 || !Number.isSafeInteger(location.column) ||
            typeof entry.projectName !== 'string' || entry.projectName.length>200 ||
            !Array.isArray(entry.path) || entry.path.length>64 || entry.path.some(v=>typeof v!=='string'||v.length>500) ||
            !Array.isArray(entry.results)) throw Error('Incomplete Playwright test location or outcome.');
        for (const attempt of entry.results) {
          if (!statuses.has(attempt.status) || rows.length>=500) throw Error('Unsupported outcome or too many matching attempts.');
          rows.push({file:location.file.replaceAll('\\','/'),name:title,project:entry.projectName,line:location.line,
            column:location.column,suitePath:entry.path,outcome:attempt.status});
        }
      }
    }
    return {rows,sha256:createHash('sha256').update(html).digest('hex')};
  } finally { zip.close(); }
}

export async function fetchRunnerReport(input,title,fetchImpl=fetch) {
  const ref = pinnedReportUrl(input);
  const response = await fetchImpl(ref,{redirect:'error',signal:AbortSignal.timeout(10000)});
  if (!response.ok || !response.body) throw Error('Cannot read the public report (HTTP '+response.status+').');
  if (Number(response.headers.get('content-length'))>maxHtml) throw Error('Playwright report exceeds 4 MiB.');
  const bytes = await bounded(response.body,maxHtml);
  return {ref,...await inspectReport(bytes,title)};
}

export function summarizeRunner(report) {
  const groups = new Map();
  for (const {outcome,...location} of report.rows) {
    const key = JSON.stringify(location);
    if (!groups.has(key)) groups.set(key,{...location,outcomes:{}});
    const counts = groups.get(key).outcomes;
    counts[outcome] = (counts[outcome] || 0) + 1;
  }
  return {ref:report.ref,sha256:report.sha256,attempts:report.rows.length,locations:[...groups.values()]};
}
