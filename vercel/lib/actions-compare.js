import {fromBufferPromise} from 'yauzl';

const repo = 'kallurayaankit/release-radar';
const limit = 512 * 1024;
const reply = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});
class ReportError extends Error {}

async function boundedBytes(stream) {
  let size = 0;
  const chunks = [];
  for await (const part of stream) {
    size += part.length;
    if (size > limit) throw new ReportError('A CI report exceeds the 512 KiB comparison limit.');
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}

async function extractReport(bytes) {
  const archive = await fromBufferPromise(bytes);
  try {
    if (archive.entryCount !== 1) throw new ReportError('Expected one junit.xml file in the CI artifact.');
    for await (const entry of archive.eachEntry()) {
      if (entry.fileName !== 'junit.xml' || entry.uncompressedSize > limit) throw new ReportError('Invalid CI report file or size.');
      return (await boundedBytes(await archive.openReadStreamPromise(entry))).toString('utf8');
    }
  } finally { archive.close(); }
}

export async function compareActionsRuns(request, origin, fetchImpl = fetch) {
  if (request.method !== 'POST') return reply({error:'Use POST.'},405);
  if (request.headers.get('Origin') !== origin) return reply({error:'Open Compare runs on the production site.'},403);
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer github_pat_[a-zA-Z0-9_]{10,300}$/.test(authorization)) return reply({error:'Enter a fine-grained GitHub token with Actions read access.'},401);
  const signal = AbortSignal.timeout(25000);
  const github = async path => {
    const response = await fetchImpl('https://api.github.com/repos/' + repo + '/actions/' + path, {
      headers:{Authorization:authorization, Accept:'application/vnd.github+json','User-Agent':'ReleaseRadar'},
      redirect:'manual', signal
    });
    if ([401,403,404,429].includes(response.status)) throw new ReportError('GitHub denied access or reached its request limit. Check Actions read permission and try again.');
    return response;
  };
  async function readRun(run) {
    const label = 'Run #' + run.run_number + ' · attempt ' + run.run_attempt + ' · ' + run.head_sha.slice(0,7);
    const name = 'junit-results-' + run.run_attempt;
    const list = await github('runs/' + run.id + '/artifacts?name=' + name);
    if (!list.ok) throw Error();
    const artifact = (await list.json()).artifacts.find(item => item.name === name && !item.expired);
    if (!artifact) throw new ReportError(label + ' has no retained JUnit artifact. Both completed runs need reports.');
    const download = await github('artifacts/' + artifact.id + '/zip');
    if (download.status !== 302) throw new ReportError('GitHub could not provide the artifact download.');
    const url = new URL(download.headers.get('location'));
    if (url.protocol !== 'https:') throw Error();
    // The signed storage URL authenticates itself. Never forward the GitHub token.
    const blob = await fetchImpl(url, {redirect:'error', signal});
    if (!blob.ok) throw Error();
    return {id:run.id, label, xml:await extractReport(await boundedBytes(blob.body))};
  }
  try {
    const response = await github('workflows/vercel.yml/runs?branch=main&event=push&status=completed&per_page=2');
    if (!response.ok) throw Error();
    const runs = (await response.json()).workflow_runs;
    if (runs.length < 2) throw new ReportError('Waiting for two completed main push runs.');
    const [candidate, baseline] = await Promise.all(runs.slice(0,2).map(readRun));
    return reply({baseline,candidate});
  } catch (error) {
    return reply({error:error instanceof ReportError ? error.message : 'Could not read the reports from GitHub. Please retry.'},error instanceof ReportError ? 422 : 502);
  }
}
