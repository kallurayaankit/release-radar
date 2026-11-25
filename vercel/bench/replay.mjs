// Read one JSON job on stdin. Run both versions on the same JUnit and diff inputs.
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import * as current from '../mcp/evidence.js';

const revision = 'ffeb43ec19b18434dce060c2b42f7e1a273957bd';
const previousSource = execFileSync('git',['show',revision+':vercel/mcp/evidence.js'],{
  cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8'
}).replace("'saxes'",JSON.stringify(import.meta.resolve('saxes')))
  .replace("'../dist/run-classification.js'",JSON.stringify(new URL('../dist/run-classification.js',import.meta.url).href));
const previous = await import('data:text/javascript;base64,'+Buffer.from(previousSource).toString('base64'));
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const jobs = JSON.parse(Buffer.concat(chunks));
const result = {};
for (const [version,tool] of Object.entries({previous,current})) {
  const start = performance.now();
  const pairs = jobs.map(job=>{
    const a = tool.readCases(job.before), b = tool.readCases(job.after);
    const comparison = tool.compareReports(a,b,{limit:0});
    const missing = job.queries.map(({identity,diff,runnerReport})=>tool.investigate(a,b,identity,diff,runnerReport));
    return {count:comparison.counts['Missing in candidate'] || 0,missing};
  });
  result[version] = {ms:performance.now()-start,pairs};
}
process.stdout.write(JSON.stringify(result));
